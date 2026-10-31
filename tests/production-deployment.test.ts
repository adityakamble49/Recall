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
    expect(workflow).toContain("CHROME_EXTENSION_SIGNING_KEY: ${{ secrets.CHROME_EXTENSION_SIGNING_KEY }}");
    expect(workflow).toMatch(/actions\/checkout@[a-f0-9]{40}/);
    expect(workflow).toMatch(/actions\/setup-node@[a-f0-9]{40}/);
    expect(workflow).toMatch(/actions\/upload-artifact@[a-f0-9]{40}/);
  });

  it("tests and builds the exact artifact deployed to production", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain("run: npm test");
    expect(workflow).toContain("run: npm exec -- tsc --noEmit");
    expect(workflow).toContain('npm run extension:package:prod -- --version "${GITHUB_REF_NAME#v}" --crx');
    expect(workflow).toContain("path: artifacts/chrome/recall-chrome-*");
    expect(workflow).toContain('rm -f "$RUNNER_TEMP/recall-extension-upload.pem"');
    expect(workflow).toContain("npm install --global --ignore-scripts vercel@59.10.0");
    expect(workflow).toContain("vercel build --prod");
    expect(workflow).toContain("vercel deploy --prebuilt --prod");
  });

  it("publishes the extension in a separate job that never sees the signing key", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");
    const [deployJob, publishJob] = workflow.split("\n  publish-extension:\n");

    expect(publishJob).toBeDefined();
    expect(publishJob).toContain("needs: deploy");
    expect(publishJob).toContain("environment: chrome-web-store");
    expect(publishJob).toContain("id-token: write");
    expect(publishJob).toContain("group: chrome-web-store");
    expect(publishJob).toContain("CWS_ITEM_ID: mifdhnokgeipckgedpbnccdlllpdpcel");
    expect(publishJob).toContain('sha256sum -c "recall-chrome-${GITHUB_REF_NAME}.sha256"');
    expect(publishJob).toContain("access_token_scopes: https://www.googleapis.com/auth/chromewebstore");
    expect(publishJob).toContain("create_credentials_file: false");
    expect(publishJob).toContain("CWS_ACCESS_TOKEN: ${{ steps.store-auth.outputs.access_token }}");
    expect(publishJob).toContain("node scripts/publish-extension.mjs");
    expect(publishJob).not.toContain("CHROME_EXTENSION_SIGNING_KEY");
    expect(publishJob).not.toContain("secrets.");

    expect(deployJob).not.toContain("id-token");
    expect(deployJob).not.toContain("google-github-actions");
    expect(deployJob).not.toContain("CWS_");
  });

  it("pins every action to a full commit SHA", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");
    const uses = [...workflow.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1]);

    expect(uses.length).toBeGreaterThan(0);
    for (const reference of uses) expect(reference).toMatch(/@[a-f0-9]{40}$/);
  });
});
