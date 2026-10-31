import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  API_BASE,
  compareVersions,
  crxToZip,
  packagesDiffer,
  publishExtension,
} from "../scripts/publish-extension.mjs";

const ITEM_ID = "mifdhnokgeipckgedpbnccdlllpdpcel";
const PUBLISHER = "publisher-1";
const ITEM = `publishers/${PUBLISHER}/items/${ITEM_ID}`;
const TOKEN = "ya29.secret-store-token";
const ROOT = mkdtempSync(resolve(tmpdir(), "recall-extension-publish-"));

const BASE_MANIFEST = { manifest_version: 3, name: "Recall - Bookmark Tracker", permissions: ["tabs"] };

function makeZip(name: string, files: Record<string, string>): string {
  const directory = resolve(ROOT, `${name}-src`);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  for (const [file, contents] of Object.entries(files)) {
    mkdirSync(resolve(directory, file, ".."), { recursive: true });
    writeFileSync(resolve(directory, file), contents);
  }
  const zipPath = resolve(ROOT, `${name}.zip`);
  rmSync(zipPath, { force: true });
  execFileSync("zip", ["-q", "-r", zipPath, "."], { cwd: directory });
  return zipPath;
}

function crxFrom(zipPath: string): Buffer {
  const header = Buffer.from("signed-header");
  const prefix = Buffer.alloc(12);
  prefix.write("Cr24", 0, "latin1");
  prefix.writeUInt32LE(3, 4);
  prefix.writeUInt32LE(header.length, 8);
  return Buffer.concat([prefix, header, readFileSync(zipPath)]);
}

function manifest(version: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ ...BASE_MANIFEST, version, ...extra });
}

type Call = { method: string; url: string; headers: Record<string, string>; body?: unknown };

function storeMock(responses: {
  status: unknown[];
  published?: Buffer;
  upload?: unknown;
  publish?: unknown;
  failWith?: { url: string; status: number; body: unknown };
}) {
  const calls: Call[] = [];
  const statuses = [...responses.status];
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method: init.method ?? "GET", url, headers, body: init.body });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (responses.failWith && url.includes(responses.failWith.url)) {
      return json(responses.failWith.body, responses.failWith.status);
    }
    if (url.startsWith("https://clients2.google.com/")) {
      return new Response(new Uint8Array(responses.published ?? Buffer.alloc(0)), { status: 200 });
    }
    if (url === `${API_BASE}/v2/${ITEM}:fetchStatus`) return json(statuses.shift() ?? {});
    if (url === `${API_BASE}/upload/v2/${ITEM}:upload`) return json(responses.upload ?? {});
    if (url === `${API_BASE}/v2/${ITEM}:publish`) return json(responses.publish ?? {});
    return json({ error: { message: "unexpected" } }, 404);
  };
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const published = (version: string) => ({
  publishedItemRevisionStatus: { state: "PUBLISHED", distributionChannels: [{ crxVersion: version, deployPercentage: 100 }] },
});

let oldZip: string;
let changedZip: string;
let crxPath: string;
let lines: string[];

beforeAll(() => {
  oldZip = makeZip("published", {
    "manifest.json": manifest("1.0.2", { update_url: "https://clients2.google.com/service/update2/crx" }),
    "popup.js": "console.log('v1');",
    "_metadata/verified_contents.json": "{}",
  });
  makeZip("unchanged", { "manifest.json": manifest("1.0.8"), "popup.js": "console.log('v1');" });
  changedZip = makeZip("changed", { "manifest.json": manifest("1.0.8"), "popup.js": "console.log('v2');" });
  crxPath = resolve(ROOT, "release.crx");
  writeFileSync(crxPath, crxFrom(changedZip));
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  lines = [];
});

type PublishOptions = {
  version?: string;
  crxPath?: string;
  zipPath?: string;
  publisherId?: string;
  itemId?: string;
  accessToken?: string;
  dryRun?: boolean;
  maxPolls?: number;
  fetchImpl: typeof fetch;
};

function run(options: PublishOptions) {
  const publish = publishExtension as unknown as (input: Record<string, unknown>) => Promise<{ action: string }>;
  return publish({
    version: "1.0.8",
    crxPath,
    zipPath: changedZip,
    publisherId: PUBLISHER,
    itemId: ITEM_ID,
    accessToken: TOKEN,
    pollIntervalMs: 0,
    log: (line: string) => lines.push(line),
    ...options,
  });
}

describe("package comparison", () => {
  it("ignores version, update_url and the Store's _metadata", async () => {
    const publishedZip = readFileSync(oldZip);
    expect(await packagesDiffer(resolve(ROOT, "unchanged.zip"), publishedZip)).toBe(false);
    expect(await packagesDiffer(changedZip, publishedZip)).toBe(true);
  });

  it("detects manifest changes other than the version", async () => {
    const permissionChange = makeZip("permission", {
      "manifest.json": manifest("1.0.8", { permissions: ["tabs", "storage"] }),
      "popup.js": "console.log('v1');",
    });
    expect(await packagesDiffer(permissionChange, readFileSync(oldZip))).toBe(true);
  });

  it("extracts the archive from a CRX3 file and rejects other formats", () => {
    const zip = readFileSync(oldZip);
    expect(crxToZip(crxFrom(oldZip)).equals(zip)).toBe(true);
    expect(() => crxToZip(zip)).toThrow("not a CRX3");
  });

  it("compares dotted versions numerically", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
    expect(compareVersions("1.0.2", "1.0.2")).toBe(0);
    expect(compareVersions("1.0", "1.0.1")).toBe(-1);
  });
});

describe("publishExtension", () => {
  it("skips without uploading when the extension is unchanged", async () => {
    const store = storeMock({ status: [published("1.0.2")], published: crxFrom(oldZip) });

    const result = await run({ zipPath: resolve(ROOT, "unchanged.zip"), fetchImpl: store.fetchImpl });

    expect(result.action).toBe("skipped-unchanged");
    expect(store.calls.some((call) => call.url.includes(":upload"))).toBe(false);
  });

  it("uploads the CRX and publishes immediately after review when the extension changed", async () => {
    const store = storeMock({
      status: [published("1.0.2"), { ...published("1.0.2"), submittedItemRevisionStatus: { state: "PENDING_REVIEW", distributionChannels: [{ crxVersion: "1.0.8" }] } }],
      published: crxFrom(oldZip),
      upload: { uploadState: "SUCCEEDED", crxVersion: "1.0.8" },
      publish: { state: "PENDING_REVIEW" },
    });

    const result = await run({ fetchImpl: store.fetchImpl });

    expect(result.action).toBe("submitted");
    const upload = store.calls.find((call) => call.url.endsWith(":upload"))!;
    expect(upload.method).toBe("POST");
    expect(Buffer.from(upload.body as Buffer).equals(readFileSync(crxPath))).toBe(true);
    const publish = store.calls.find((call) => call.url.endsWith(":publish"))!;
    expect(JSON.parse(publish.body as string)).toEqual({ publishType: "DEFAULT_PUBLISH" });
  });

  it("sends the token only to the Store API, never to the public download", async () => {
    const store = storeMock({
      status: [published("1.0.2"), {}],
      published: crxFrom(oldZip),
      upload: { uploadState: "SUCCEEDED", crxVersion: "1.0.8" },
    });

    await run({ fetchImpl: store.fetchImpl });

    for (const call of store.calls) {
      const authorized = call.headers.Authorization === `Bearer ${TOKEN}`;
      expect(authorized).toBe(call.url.startsWith(API_BASE));
    }
    expect(lines.join("\n")).not.toContain(TOKEN);
  });

  it("refuses to replace a different version that is pending review", async () => {
    const store = storeMock({
      status: [{ ...published("1.0.2"), submittedItemRevisionStatus: { state: "PENDING_REVIEW", distributionChannels: [{ crxVersion: "1.0.7" }] } }],
      published: crxFrom(oldZip),
    });

    await expect(run({ fetchImpl: store.fetchImpl })).rejects.toThrow("1.0.7 is PENDING_REVIEW");
    expect(store.calls.some((call) => call.url.includes(":upload"))).toBe(false);
  });

  it("treats a re-run of an already submitted version as done", async () => {
    const store = storeMock({
      status: [{ ...published("1.0.2"), submittedItemRevisionStatus: { state: "STAGED", distributionChannels: [{ crxVersion: "1.0.8" }] } }],
      published: crxFrom(oldZip),
    });

    expect((await run({ fetchImpl: store.fetchImpl })).action).toBe("skipped-already-submitted");
  });

  it("rejects a version that is not higher than the published one", async () => {
    const store = storeMock({ status: [published("1.0.9")], published: crxFrom(oldZip) });

    await expect(run({ fetchImpl: store.fetchImpl })).rejects.toThrow("must be higher");
  });

  it("does not upload in dry-run mode", async () => {
    const store = storeMock({ status: [published("1.0.2")], published: crxFrom(oldZip) });

    expect((await run({ dryRun: true, fetchImpl: store.fetchImpl })).action).toBe("dry-run");
    expect(store.calls.some((call) => call.url.includes(":upload"))).toBe(false);
  });

  it("waits for asynchronous upload processing before publishing", async () => {
    const store = storeMock({
      status: [published("1.0.2"), { lastAsyncUploadState: "IN_PROGRESS" }, { lastAsyncUploadState: "SUCCEEDED" }, {}],
      published: crxFrom(oldZip),
      upload: { uploadState: "IN_PROGRESS" },
    });

    expect((await run({ fetchImpl: store.fetchImpl })).action).toBe("submitted");
  });

  it("stops without publishing when processing does not finish", async () => {
    const store = storeMock({
      status: [published("1.0.2"), { lastAsyncUploadState: "IN_PROGRESS" }, { lastAsyncUploadState: "IN_PROGRESS" }],
      published: crxFrom(oldZip),
      upload: { uploadState: "IN_PROGRESS" },
    });

    await expect(run({ maxPolls: 2, fetchImpl: store.fetchImpl })).rejects.toThrow("still processing");
    expect(store.calls.some((call) => call.url.endsWith(":publish"))).toBe(false);
  });

  it("stops when the Store reads a different version from the package", async () => {
    const store = storeMock({
      status: [published("1.0.2")],
      published: crxFrom(oldZip),
      upload: { uploadState: "SUCCEEDED", crxVersion: "1.0.3" },
    });

    await expect(run({ fetchImpl: store.fetchImpl })).rejects.toThrow("expected 1.0.8");
    expect(store.calls.some((call) => call.url.endsWith(":publish"))).toBe(false);
  });

  it("reports API errors without leaking the token", async () => {
    const store = storeMock({
      status: [],
      failWith: { url: ":fetchStatus", status: 403, body: { error: { message: "The caller does not have permission" } } },
    });

    const error = await run({ fetchImpl: store.fetchImpl }).catch((caught: Error) => caught);
    expect(String(error)).toContain("does not have permission");
    expect(String(error)).not.toContain(TOKEN);
  });

  it("validates required inputs before any request", async () => {
    const store = storeMock({ status: [] });

    await expect(run({ accessToken: "", fetchImpl: store.fetchImpl })).rejects.toThrow("access token");
    await expect(run({ itemId: "not-an-id", fetchImpl: store.fetchImpl })).rejects.toThrow("Item ID");
    expect(store.calls).toEqual([]);
  });
});
