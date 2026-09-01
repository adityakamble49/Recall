import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = process.cwd();
const BUILD_SCRIPT = resolve(ROOT, "scripts/build-extension.mjs");
const OUTPUT_ROOT = resolve(ROOT, "build", "extension");
const EXPECTED_FILES = [
  "auth.js",
  "background.js",
  "config.js",
  "icon128.png",
  "icon16.png",
  "icon48.png",
  "manifest.json",
  "popup.html",
  "popup.js",
].sort();

describe("extension environment builds", () => {
  beforeAll(() => {
    build("dev");
    build("prod");
  });

  it.each([
    ["dev", "Recall - Bookmark Tracker (DEV)", "http://localhost:3030/*"],
    ["prod", "Recall - Bookmark Tracker", "https://recall.ltd/*"],
  ])("builds an isolated %s artifact", (target, name, hostPermission) => {
    const directory = resolve(OUTPUT_ROOT, target);
    const manifest = JSON.parse(readFileSync(resolve(directory, "manifest.json"), "utf8"));

    expect(readdirSync(directory).sort()).toEqual(EXPECTED_FILES);
    expect(manifest).toEqual(expect.objectContaining({
      manifest_version: 3,
      name,
      host_permissions: [hostPermission],
    }));
    expect(manifest).not.toHaveProperty("optional_host_permissions");
  });

  it("contains no production endpoint in the development artifact", () => {
    expect(textContents(resolve(OUTPUT_ROOT, "dev"))).not.toContain("https://recall.ltd");
  });

  it("contains no localhost endpoint or runtime environment switch in production", () => {
    const contents = textContents(resolve(OUTPUT_ROOT, "prod"));

    expect(contents).not.toContain("localhost");
    expect(contents).not.toContain("Save & Reconnect");
    expect(contents).not.toContain("api-url-input");
    expect(contents).not.toContain("chrome.permissions.request");
  });

  it("rebuilds the same production artifact deterministically", () => {
    const before = artifactHashes(resolve(OUTPUT_ROOT, "prod"));
    build("prod");
    expect(artifactHashes(resolve(OUTPUT_ROOT, "prod"))).toEqual(before);
  });
});

function build(target: "dev" | "prod") {
  execFileSync(process.execPath, [BUILD_SCRIPT, "--target", target], {
    cwd: ROOT,
    stdio: "pipe",
  });
}

function textContents(directory: string): string {
  return readdirSync(directory)
    .filter((file) => [".html", ".js", ".json"].some((extension) => file.endsWith(extension)))
    .map((file) => readFileSync(resolve(directory, file), "utf8"))
    .join("\n");
}

function artifactHashes(directory: string): Record<string, string> {
  return Object.fromEntries(readdirSync(directory).sort().map((file) => [
    file,
    createHash("sha256").update(readFileSync(resolve(directory, file))).digest("hex"),
  ]));
}
