import {
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, "..");
const TARGETS = new Set(["dev", "prod"]);

export const EXTENSION_RUNTIME_FILES = [
  "auth.js",
  "background.js",
  "config.js",
  "icon16.png",
  "icon48.png",
  "icon128.png",
  "popup.html",
  "popup.js",
];

export async function buildExtension(
  target,
  {
    projectRoot = DEFAULT_PROJECT_ROOT,
    outputRoot = resolve(projectRoot, "build", "extension"),
  } = {},
) {
  if (!TARGETS.has(target)) {
    throw new Error(`Unknown extension target: ${String(target)}`);
  }

  const sourceRoot = resolve(projectRoot, "extension");
  const outputDirectory = resolve(outputRoot, target);
  const baseManifest = await readJson(resolve(sourceRoot, "manifest.base.json"));
  const environments = await readJson(resolve(sourceRoot, "environments.json"));
  const environment = environments[target];
  validateManifestConfiguration(baseManifest, environment, target);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all(EXTENSION_RUNTIME_FILES.map((file) => copyFile(
    resolve(sourceRoot, file),
    resolve(outputDirectory, file),
  )));

  const manifest = { ...baseManifest, ...environment };
  await writeFile(
    resolve(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  return outputDirectory;
}

function validateManifestConfiguration(baseManifest, environment, target) {
  if (!baseManifest || typeof baseManifest !== "object" || Array.isArray(baseManifest)) {
    throw new Error("Extension base manifest must be an object");
  }
  if (!/^\d+(?:\.\d+){0,3}$/.test(baseManifest.version ?? "")) {
    throw new Error("Extension version must contain one to four numeric components");
  }
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    throw new Error(`Missing extension configuration for ${target}`);
  }
  if (typeof environment.name !== "string" || environment.name.length === 0) {
    throw new Error(`Missing extension name for ${target}`);
  }
  if (!Array.isArray(environment.host_permissions) || environment.host_permissions.length !== 1) {
    throw new Error(`${target} must declare exactly one API host permission`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseTarget(argumentsList) {
  if (argumentsList.length !== 2 || argumentsList[0] !== "--target") {
    throw new Error("Usage: node scripts/build-extension.mjs --target <dev|prod>");
  }
  return argumentsList[1];
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  const target = parseTarget(process.argv.slice(2));
  const output = await buildExtension(target);
  process.stdout.write(`${output}\n`);
}
