import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const EXTENSION_ROOT = resolve(ROOT, "extension");
const WEB_ROOTS = ["app", "components", "lib"]
  .map((directory) => resolve(ROOT, directory));
const WEB_ENTRY_FILES = [resolve(ROOT, "proxy.ts")];

describe("web and extension module boundaries", () => {
  it("does not let web or server modules import extension implementation files", () => {
    const violations = [...WEB_ROOTS.flatMap(sourceFiles), ...WEB_ENTRY_FILES]
      .flatMap((file) => importSpecifiers(file)
        .filter((specifier) => resolvesInside(specifier, file, EXTENSION_ROOT))
        .map((specifier) => `${relative(ROOT, file)} -> ${specifier}`));

    expect(violations).toEqual([]);
  });

  it("does not let extension modules import web or server implementation files", () => {
    const violations = sourceFiles(EXTENSION_ROOT)
      .flatMap((file) => importSpecifiers(file)
        .filter((specifier) => {
          if (specifier.startsWith("@/")) return true;
          if (specifier.startsWith(".")) {
            return !resolvesInside(specifier, file, EXTENSION_ROOT);
          }
          return specifier.startsWith("/");
        })
        .map((specifier) => `${relative(ROOT, file)} -> ${specifier}`));

    expect(violations).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".js", ".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function resolvesInside(specifier: string, importer: string, targetRoot: string): boolean {
  let resolved: string;
  if (specifier.startsWith("@/")) {
    resolved = resolve(ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    resolved = resolve(dirname(importer), specifier);
  } else {
    return false;
  }
  return resolved === targetRoot || resolved.startsWith(`${targetRoot}${sep}`);
}
