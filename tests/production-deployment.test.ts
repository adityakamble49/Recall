import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const WORKFLOW_PATH = resolve(ROOT, ".github/workflows/deploy-production.yml");

describe("production deployment configuration", () => {
  it("disables every deployment created by the Vercel Git integration", () => {
    const config = JSON.parse(readFileSync(resolve(ROOT, "vercel.json"), "utf8"));

    expect(config.git?.deploymentEnabled).toBe(false);
  });

  it("deploys only strict version tags through the production environment", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain('      - "v*.*.*"');
    expect(workflow).not.toMatch(/^\s+(branches|pull_request):/m);
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("^v(0|[1-9][0-9]*)");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("origin/main");
  });

  it("uses least privilege, serialized releases, and protected credentials", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("group: production");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}");
    expect(workflow).not.toContain("VERCEL_TOKEN: ${{ vars.VERCEL_TOKEN }}");
    expect(workflow).toMatch(/actions\/checkout@[a-f0-9]{40}/);
    expect(workflow).toMatch(/actions\/setup-node@[a-f0-9]{40}/);
  });

  it("tests and builds the exact artifact deployed to production", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("run: npm test");
    expect(workflow).toContain("run: npm exec -- tsc --noEmit");
    expect(workflow).toContain("npm install --global --ignore-scripts vercel@59.10.0");
    expect(workflow).toContain("vercel build --prod");
    expect(workflow).toContain("vercel deploy --prebuilt --prod");
  });
});
