// Uploads and publishes the signed Recall CRX through the Chrome Web Store API v2.
//
// It submits only when the packaged extension differs from the version the Store
// currently serves (ignoring the manifest version), refuses to replace a pending
// review, and never logs the access token.

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const API_BASE = "https://chromewebstore.googleapis.com";
const UPDATE_URL = "https://clients2.google.com/service/update2/crx";
const BLOCKING_SUBMISSION_STATES = new Set(["PENDING_REVIEW", "STAGED"]);
// Fields the Store or the release version change without changing behavior.
const IGNORED_MANIFEST_FIELDS = ["version", "update_url", "key"];

export class PublishError extends Error {}

export async function publishExtension({
  version,
  crxPath,
  zipPath,
  publisherId,
  itemId,
  accessToken,
  dryRun = false,
  fetchImpl = fetch,
  pollIntervalMs = 10_000,
  maxPolls = 30,
  log = (line) => process.stdout.write(`${line}\n`),
}) {
  for (const [name, value] of Object.entries({ version, crxPath, zipPath, publisherId, itemId })) {
    if (!value) throw new PublishError(`Missing ${name}`);
  }
  if (!/^[a-p]{32}$/.test(itemId)) throw new PublishError("Item ID must be a 32-character Chrome extension ID");
  if (!/^[A-Za-z0-9._-]+$/.test(publisherId)) throw new PublishError("Invalid publisher ID");
  if (!accessToken) throw new PublishError("Missing Chrome Web Store access token");

  const itemName = `publishers/${publisherId}/items/${itemId}`;
  const api = createApi({ fetchImpl, accessToken });

  const status = await api.json("GET", `${API_BASE}/v2/${itemName}:fetchStatus`);
  if (status.takenDown) throw new PublishError("The Store item is taken down; check the Developer Dashboard");

  const publishedVersion = channelVersion(status.publishedItemRevisionStatus);
  if (publishedVersion) {
    const publishedZip = await downloadPublishedZip(itemId, fetchImpl);
    if (!await packagesDiffer(zipPath, publishedZip)) {
      log(`Skipped: extension is unchanged from published version ${publishedVersion}.`);
      return { action: "skipped-unchanged", publishedVersion };
    }
  }

  const submitted = status.submittedItemRevisionStatus;
  const submittedVersion = channelVersion(submitted);
  if (submitted && BLOCKING_SUBMISSION_STATES.has(submitted.state)) {
    if (submittedVersion === version) {
      log(`Skipped: version ${version} is already submitted (${submitted.state}).`);
      return { action: "skipped-already-submitted", submittedVersion };
    }
    throw new PublishError(
      `Version ${submittedVersion ?? "unknown"} is ${submitted.state}. Re-run this job after it is published.`,
    );
  }

  if (publishedVersion && compareVersions(version, publishedVersion) <= 0) {
    throw new PublishError(`Version ${version} must be higher than published version ${publishedVersion}`);
  }

  if (dryRun) {
    log(`Dry run: would upload and publish ${version} (published: ${publishedVersion ?? "none"}).`);
    return { action: "dry-run", publishedVersion };
  }

  const crx = await readFile(crxPath);
  const upload = await api.json("POST", `${API_BASE}/upload/v2/${itemName}:upload`, {
    body: crx,
    headers: { "Content-Type": "application/octet-stream" },
  });
  if (upload.uploadState === "IN_PROGRESS") {
    await waitForUpload(api, itemName, { pollIntervalMs, maxPolls });
  } else if (upload.uploadState !== "SUCCEEDED") {
    throw new PublishError(`Upload failed with state ${upload.uploadState ?? "unknown"}`);
  }
  if (upload.crxVersion && upload.crxVersion !== version) {
    throw new PublishError(`Store read version ${upload.crxVersion} from the package, expected ${version}`);
  }
  log(`Uploaded ${version}.`);

  const published = await api.json("POST", `${API_BASE}/v2/${itemName}:publish`, {
    body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
    headers: { "Content-Type": "application/json" },
  });
  for (const warning of published.warningInfo?.warnings ?? []) {
    log(`Store warning: ${warning.reason}: ${warning.description}`);
  }

  const after = await api.json("GET", `${API_BASE}/v2/${itemName}:fetchStatus`);
  const nowSubmitted = channelVersion(after.submittedItemRevisionStatus);
  if (nowSubmitted && nowSubmitted !== version) {
    throw new PublishError(`Store submitted version ${nowSubmitted}, expected ${version}`);
  }
  log(`Submitted ${version} for review (${published.state ?? "state unknown"}). It goes live automatically after approval.`);
  return { action: "submitted", state: published.state, publishedVersion };
}

function createApi({ fetchImpl, accessToken }) {
  return {
    async json(method, url, { body, headers = {} } = {}) {
      const response = await fetchImpl(url, {
        method,
        body,
        redirect: "error",
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
      });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON error body */ }
      if (!response.ok) {
        const message = typeof data?.error?.message === "string" ? data.error.message : `HTTP ${response.status}`;
        throw new PublishError(`${method} ${new URL(url).pathname} failed: ${message}`);
      }
      return data;
    },
  };
}

async function waitForUpload(api, itemName, { pollIntervalMs, maxPolls }) {
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    await new Promise((done) => setTimeout(done, pollIntervalMs));
    const status = await api.json("GET", `${API_BASE}/v2/${itemName}:fetchStatus`);
    if (status.lastAsyncUploadState === "SUCCEEDED") return;
    if (status.lastAsyncUploadState === "FAILED") throw new PublishError("Upload processing failed");
  }
  throw new PublishError("Upload is still processing; not submitting. Re-run this job later.");
}

function channelVersion(revision) {
  return revision?.distributionChannels?.find((channel) => channel?.crxVersion)?.crxVersion ?? null;
}

export function compareVersions(a, b) {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export async function downloadPublishedZip(itemId, fetchImpl = fetch) {
  const url = new URL(UPDATE_URL);
  url.searchParams.set("response", "redirect");
  url.searchParams.set("prodversion", "130.0");
  url.searchParams.set("acceptformat", "crx3");
  url.searchParams.set("x", `id=${itemId}&uc`);
  // Public download; the Store access token is never sent here.
  const response = await fetchImpl(url.toString(), { redirect: "follow" });
  if (!response.ok) throw new PublishError(`Could not download the published package: HTTP ${response.status}`);
  return crxToZip(Buffer.from(await response.arrayBuffer()));
}

export function crxToZip(crx) {
  if (crx.length < 12 || crx.subarray(0, 4).toString("latin1") !== "Cr24" || crx.readUInt32LE(4) !== 3) {
    throw new PublishError("Published package is not a CRX3 file");
  }
  const start = 12 + crx.readUInt32LE(8);
  if (start >= crx.length) throw new PublishError("Published package has no archive");
  return crx.subarray(start);
}

// True when the extension files differ, ignoring IGNORED_MANIFEST_FIELDS and the
// Store's _metadata directory.
export async function packagesDiffer(localZipPath, publishedZip) {
  const workspace = await mkdtemp(join(tmpdir(), "recall-publish-"));
  try {
    const publishedZipPath = join(workspace, "published.zip");
    await writeFile(publishedZipPath, publishedZip);
    const [local, published] = await Promise.all([
      extract(localZipPath, join(workspace, "local")),
      extract(publishedZipPath, join(workspace, "published")),
    ]);
    const localFiles = Object.keys(local).sort();
    const publishedFiles = Object.keys(published).filter((file) => !file.startsWith("_metadata/")).sort();
    if (JSON.stringify(localFiles) !== JSON.stringify(publishedFiles)) return true;
    return localFiles.some((file) => file === "manifest.json"
      ? normalizedManifest(local[file]) !== normalizedManifest(published[file])
      : !local[file].equals(published[file]));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function normalizedManifest(contents) {
  const manifest = JSON.parse(contents.toString("utf8"));
  for (const field of IGNORED_MANIFEST_FIELDS) delete manifest[field];
  return JSON.stringify(sortKeys(manifest));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
  }
  return value;
}

async function extract(zipPath, destination) {
  const result = spawnSync("unzip", ["-q", "-o", zipPath, "-d", destination], { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new PublishError(`unzip failed: ${result.stderr?.trim() || result.status}`);
  const files = {};
  for (const path of await listFiles(destination)) {
    files[relative(destination, path).split("\\").join("/")] = await readFile(path);
  }
  return files;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return nested.flat();
}

function parseArguments(argumentsList) {
  const options = { dryRun: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--dry-run") { options.dryRun = true; continue; }
    if (["--version", "--crx", "--zip"].includes(argument)) {
      const value = argumentsList[index + 1];
      if (!value) throw new PublishError(`Missing value for ${argument}`);
      index += 1;
      if (argument === "--version") options.version = value;
      if (argument === "--crx") options.crxPath = resolve(value);
      if (argument === "--zip") options.zipPath = resolve(value);
      continue;
    }
    throw new PublishError(`Unknown argument: ${argument}`);
  }
  return options;
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  const summaryLines = [];
  try {
    const result = await publishExtension({
      ...parseArguments(process.argv.slice(2)),
      publisherId: process.env.CWS_PUBLISHER_ID,
      itemId: process.env.CWS_ITEM_ID,
      accessToken: process.env.CWS_ACCESS_TOKEN,
      log: (line) => { summaryLines.push(line); process.stdout.write(`${line}\n`); },
    });
    summaryLines.push(`Result: \`${result.action}\``);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    summaryLines.push(`Failed: ${message}`);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  } finally {
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        `### Chrome Web Store\n\n${summaryLines.map((line) => `- ${line}`).join("\n")}\n`);
    }
  }
}
