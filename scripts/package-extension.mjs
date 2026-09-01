import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildExtension,
  EXTENSION_RUNTIME_FILES,
  validateExtensionVersion,
} from "./build-extension.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const FIXED_ARCHIVE_TIME = new Date("2000-01-01T00:00:00.000Z");
const EXPECTED_FILES = [...EXTENSION_RUNTIME_FILES, "manifest.json"].sort();
const EXPECTED_PERMISSIONS = ["identity", "storage", "tabGroups", "tabs"];
const PRODUCTION_HOST_PERMISSION = "https://recall.ltd/*";

export async function packageProductionExtension({
  version = "",
  includeCrx = false,
  keyPath = process.env.RECALL_EXTENSION_SIGNING_KEY_PATH,
  chromePath = process.env.CHROME_BIN,
  projectRoot = DEFAULT_PROJECT_ROOT,
  artifactsDirectory = resolve(projectRoot, "artifacts", "chrome"),
  buildOutputRoot = resolve(projectRoot, "build", "extension"),
  tag = process.env.GITHUB_REF_NAME || null,
  commit = process.env.GITHUB_SHA || gitCommit(projectRoot),
} = {}) {
  validateExtensionVersion(version);

  const signingKey = includeCrx ? await validateSigningKey(keyPath) : null;
  const outputDirectory = await buildExtension("prod", {
    projectRoot,
    outputRoot: buildOutputRoot,
    version,
  });
  await validateProductionBuild(outputDirectory, version);
  await normalizeArchiveTimes(outputDirectory);
  await mkdir(artifactsDirectory, { recursive: true });

  const artifactBaseName = `recall-chrome-v${version}`;
  const zipPath = resolve(artifactsDirectory, `${artifactBaseName}.zip`);
  const crxPath = resolve(artifactsDirectory, `${artifactBaseName}.crx`);
  const checksumPath = resolve(artifactsDirectory, `${artifactBaseName}.sha256`);
  const metadataPath = resolve(artifactsDirectory, `${artifactBaseName}.json`);
  await Promise.all([zipPath, crxPath, checksumPath, metadataPath]
    .map((path) => rm(path, { force: true })));
  await createZip(outputDirectory, zipPath);

  const packageArtifacts = [{ type: "zip", path: zipPath }];
  if (includeCrx) {
    await createCrx(outputDirectory, crxPath, signingKey, chromePath);
    packageArtifacts.push({ type: "crx", path: crxPath });
  }

  const artifacts = {};
  for (const artifact of packageArtifacts) {
    artifacts[artifact.type] = {
      file: basename(artifact.path),
      sha256: await sha256(artifact.path),
    };
  }

  const checksumContents = Object.values(artifacts)
    .map(({ file, sha256: digest }) => `${digest}  ${file}`)
    .join("\n");
  await writeFile(checksumPath, `${checksumContents}\n`, "utf8");

  await writeFile(metadataPath, `${JSON.stringify({
    schemaVersion: 1,
    target: "prod",
    version,
    tag,
    commit,
    artifacts,
  }, null, 2)}\n`, "utf8");

  return {
    outputDirectory,
    zipPath,
    crxPath: includeCrx ? resolve(artifactsDirectory, `${artifactBaseName}.crx`) : null,
    checksumPath,
    metadataPath,
  };
}

export async function validateProductionBuild(outputDirectory, version) {
  const entries = await readdir(outputDirectory, { withFileTypes: true });
  const files = entries.map((entry) => entry.name).sort();
  if (entries.some((entry) => !entry.isFile()) || JSON.stringify(files) !== JSON.stringify(EXPECTED_FILES)) {
    throw new Error(`Production extension contains unexpected files: ${files.join(", ")}`);
  }

  const manifest = JSON.parse(await readFile(resolve(outputDirectory, "manifest.json"), "utf8"));
  if (manifest.version !== version) throw new Error("Packaged manifest version does not match release version");
  if (manifest.name !== "Recall - Bookmark Tracker") throw new Error("Packaged extension must use the production name");
  if (JSON.stringify(manifest.host_permissions) !== JSON.stringify([PRODUCTION_HOST_PERMISSION])) {
    throw new Error("Packaged extension must use only the production host permission");
  }
  if (manifest.optional_host_permissions !== undefined) {
    throw new Error("Packaged extension must not contain optional host permissions");
  }
  if (JSON.stringify([...manifest.permissions].sort()) !== JSON.stringify(EXPECTED_PERMISSIONS)) {
    throw new Error("Packaged extension permissions differ from the reviewed permission set");
  }

  const text = (await Promise.all(files
    .filter((file) => [".html", ".js", ".json"].some((extension) => file.endsWith(extension)))
    .map((file) => readFile(resolve(outputDirectory, file), "utf8"))))
    .join("\n");
  if (text.includes("localhost")) throw new Error("Production extension contains a localhost reference");
}

async function validateSigningKey(keyPath) {
  if (!keyPath) {
    throw new Error("CRX packaging requires RECALL_EXTENSION_SIGNING_KEY_PATH or --key");
  }
  const absolutePath = resolve(keyPath);
  await access(absolutePath, constants.R_OK);
  const keyStat = await stat(absolutePath);
  if (!keyStat.isFile()) throw new Error("Extension signing key must be a file");
  if (process.platform !== "win32" && (keyStat.mode & 0o077) !== 0) {
    throw new Error("Extension signing key permissions must be restricted to the current user (chmod 600)");
  }
  const key = await readFile(absolutePath, "utf8");
  if (!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(key)) {
    throw new Error("Extension signing key is not an unencrypted PEM private key");
  }
  return absolutePath;
}

async function normalizeArchiveTimes(directory) {
  await Promise.all(EXPECTED_FILES.map((file) => utimes(
    resolve(directory, file),
    FIXED_ARCHIVE_TIME,
    FIXED_ARCHIVE_TIME,
  )));
}

async function createZip(sourceDirectory, destination) {
  await rm(destination, { force: true });
  run("zip", ["-X", "-q", destination, ...EXPECTED_FILES], {
    cwd: sourceDirectory,
    env: { ...process.env, TZ: "UTC" },
  });
}

async function createCrx(sourceDirectory, destination, keyPath, configuredChromePath) {
  const chrome = configuredChromePath || findChrome();
  const generatedCrx = `${sourceDirectory}.crx`;
  const generatedKey = `${sourceDirectory}.pem`;
  await rm(generatedCrx, { force: true });
  if (await pathExists(generatedKey)) {
    throw new Error(`Refusing to overwrite unexpected private key: ${generatedKey}`);
  }

  run(chrome, [
    `--pack-extension=${sourceDirectory}`,
    `--pack-extension-key=${keyPath}`,
  ]);
  if (await pathExists(generatedKey)) {
    await chmod(generatedKey, 0o600);
    await rm(generatedKey, { force: true });
    throw new Error("Chrome unexpectedly generated a private key instead of using the configured key");
  }
  await access(generatedCrx, constants.R_OK);
  await rm(destination, { force: true });
  await copyFile(generatedCrx, destination);
  await chmod(destination, 0o644);
  await rm(generatedCrx, { force: true });
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function findChrome() {
  const candidates = process.platform === "darwin"
    ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    : process.platform === "win32"
      ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
      : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (!result.error && result.status === 0) return candidate;
  }
  throw new Error("Google Chrome was not found; set CHROME_BIN to its executable path");
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function gitCommit(projectRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function run(command, argumentsList, options = {}) {
  const result = spawnSync(command, argumentsList, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = result.stderr?.trim() || result.stdout?.trim() || `exit code ${result.status}`;
    throw new Error(`${command} failed: ${details}`);
  }
}

function parseArguments(argumentsList) {
  const options = { includeCrx: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--crx") {
      options.includeCrx = true;
      continue;
    }
    if (["--version", "--key", "--chrome", "--output"].includes(argument)) {
      const value = argumentsList[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}`);
      index += 1;
      if (argument === "--version") options.version = value;
      if (argument === "--key") options.keyPath = value;
      if (argument === "--chrome") options.chromePath = value;
      if (argument === "--output") options.artifactsDirectory = resolve(value);
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.version) {
    throw new Error("Usage: node scripts/package-extension.mjs --version <version> [--crx] [--key <pem>] [--chrome <path>] [--output <directory>]");
  }
  return options;
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  const result = await packageProductionExtension(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${result.zipPath}\n`);
  if (result.crxPath) process.stdout.write(`${result.crxPath}\n`);
  process.stdout.write(`${result.checksumPath}\n${result.metadataPath}\n`);
}
