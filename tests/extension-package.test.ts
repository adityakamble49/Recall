import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  packageProductionExtension,
  validateProductionBuild,
} from "../scripts/package-extension.mjs";

const ROOT = process.cwd();
const TEMPORARY_ROOT = mkdtempSync(resolve(tmpdir(), "recall-extension-package-"));
const ARTIFACTS_DIRECTORY = resolve(TEMPORARY_ROOT, "artifacts");
const BUILD_OUTPUT_ROOT = resolve(TEMPORARY_ROOT, "build");
const VERSION = "7.6.5";

describe("production extension packaging", () => {
  let packaged: Awaited<ReturnType<typeof packageProductionExtension>>;

  beforeAll(async () => {
    packaged = await packageProductionExtension({
      version: VERSION,
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
      tag: "v7.6.5",
      commit: "0123456789abcdef",
    });
  });

  afterAll(() => {
    rmSync(TEMPORARY_ROOT, { recursive: true, force: true });
  });

  it("creates a root-level production ZIP with the requested version", () => {
    const files = execFileSync("unzip", ["-Z1", packaged.zipPath], { encoding: "utf8" })
      .trim()
      .split("\n")
      .sort();
    const manifest = JSON.parse(execFileSync(
      "unzip",
      ["-p", packaged.zipPath, "manifest.json"],
      { encoding: "utf8" },
    ));

    expect(files).toEqual([
      "auth.js",
      "background.js",
      "config.js",
      "icon128.png",
      "icon16.png",
      "icon48.png",
      "manifest.json",
      "popup.html",
      "popup.js",
    ]);
    expect(manifest.version).toBe(VERSION);
    expect(manifest.host_permissions).toEqual(["https://recall.ltd/*"]);
    expect(readFileSync(packaged.zipPath).includes(Buffer.from("localhost"))).toBe(false);
  });

  it("rebuilds the ZIP byte-for-byte deterministically", async () => {
    const firstDigest = digest(packaged.zipPath);
    const rebuilt = await packageProductionExtension({
      version: VERSION,
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
      tag: "v7.6.5",
      commit: "0123456789abcdef",
    });

    expect(digest(rebuilt.zipPath)).toBe(firstDigest);
  });

  it("removes a stale CRX when creating a ZIP-only package", async () => {
    const staleCrx = resolve(ARTIFACTS_DIRECTORY, `recall-chrome-v${VERSION}.crx`);
    writeFileSync(staleCrx, "stale-signed-package");

    await packageProductionExtension({
      version: VERSION,
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
      tag: "v7.6.5",
      commit: "0123456789abcdef",
    });

    expect(existsSync(staleCrx)).toBe(false);
  });

  it("writes checksums and release metadata", () => {
    const checksum = readFileSync(packaged.checksumPath, "utf8");
    const metadata = JSON.parse(readFileSync(packaged.metadataPath, "utf8"));

    expect(checksum).toContain(`  recall-chrome-v${VERSION}.zip`);
    expect(metadata).toEqual(expect.objectContaining({
      schemaVersion: 1,
      target: "prod",
      version: VERSION,
      tag: "v7.6.5",
      commit: "0123456789abcdef",
    }));
    expect(metadata.artifacts.zip.sha256).toBe(digest(packaged.zipPath));
  });

  it("refuses CRX packaging without an existing signing key", async () => {
    await expect(packageProductionExtension({
      version: VERSION,
      includeCrx: true,
      keyPath: "",
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
    })).rejects.toThrow("CRX packaging requires");
  });

  it("refuses a signing key readable by other local users", async () => {
    if (process.platform === "win32") return;
    const signingKey = resolve(TEMPORARY_ROOT, "insecure.pem");
    writeFileSync(signingKey, [
      "-----BEGIN PRIVATE KEY-----",
      "test-only-key",
      "-----END PRIVATE KEY-----",
      "",
    ].join("\n"), { mode: 0o644 });

    await expect(packageProductionExtension({
      version: VERSION,
      includeCrx: true,
      keyPath: signingKey,
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
    })).rejects.toThrow("chmod 600");
  });

  it("passes an explicit private key to Chrome and includes the CRX checksum", async () => {
    const signingKey = resolve(TEMPORARY_ROOT, "upload.pem");
    const fakeChrome = resolve(TEMPORARY_ROOT, "fake-chrome");
    writeFileSync(signingKey, [
      "-----BEGIN PRIVATE KEY-----",
      "test-only-key",
      "-----END PRIVATE KEY-----",
      "",
    ].join("\n"), { mode: 0o600 });
    writeFileSync(fakeChrome, `#!/bin/sh
extension=""
key=""
for argument in "$@"; do
  case "$argument" in
    --pack-extension=*) extension="\${argument#--pack-extension=}" ;;
    --pack-extension-key=*) key="\${argument#--pack-extension-key=}" ;;
  esac
done
test -f "$key" || exit 2
printf 'test-crx' > "\${extension}.crx"
`, { mode: 0o700 });
    chmodSync(fakeChrome, 0o700);

    const signed = await packageProductionExtension({
      version: "7.6.6",
      includeCrx: true,
      keyPath: signingKey,
      chromePath: fakeChrome,
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
      tag: "v7.6.6",
      commit: "fedcba9876543210",
    });

    expect(readFileSync(signed.crxPath!)).toEqual(Buffer.from("test-crx"));
    expect(readFileSync(signed.checksumPath, "utf8")).toContain("recall-chrome-v7.6.6.crx");
    expect(JSON.parse(readFileSync(signed.metadataPath, "utf8")).artifacts.crx.sha256)
      .toBe(digest(signed.crxPath!));
    expect(readdirSync(ARTIFACTS_DIRECTORY).some((file) => file.endsWith(".pem"))).toBe(false);
  });

  it("rejects versions outside Chrome's numeric component range", async () => {
    await expect(packageProductionExtension({
      version: "1.65536.0",
      projectRoot: ROOT,
      artifactsDirectory: ARTIFACTS_DIRECTORY,
      buildOutputRoot: BUILD_OUTPUT_ROOT,
    })).rejects.toThrow("must not exceed 65535");
  });

  it("rejects unexpected files before packaging", async () => {
    writeFileSync(resolve(packaged.outputDirectory, "private.pem"), "not-a-key");
    await expect(validateProductionBuild(packaged.outputDirectory, VERSION))
      .rejects.toThrow("unexpected files");
  });
});

function digest(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
