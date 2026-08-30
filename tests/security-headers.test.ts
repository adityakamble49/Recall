import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  createCspNonce,
  setBaselineSecurityHeaders,
} from "@/lib/security-headers";
import { config, proxy } from "@/proxy";

describe("content security policy", () => {
  it("creates a new unpredictable nonce for every document request", () => {
    const first = createCspNonce();
    const second = createCspNonce();

    expect(first).toMatch(/^[a-f0-9]{32}$/);
    expect(second).toMatch(/^[a-f0-9]{32}$/);
    expect(first).not.toBe(second);
  });

  it("uses a nonce without unsafe script execution in production", () => {
    const policy = buildContentSecurityPolicy("test-nonce");

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic';");
    expect(policy).toContain("script-src-attr 'none';");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("upgrade-insecure-requests;");
  });

  it("allows only development requirements when development mode is enabled", () => {
    const policy = buildContentSecurityPolicy("dev-nonce", { isDevelopment: true });

    expect(policy).toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("connect-src 'self' ws: wss:;");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("restricts dangerous resource and embedding capabilities", () => {
    const policy = buildContentSecurityPolicy("test-nonce");

    expect(policy).toContain("object-src 'none';");
    expect(policy).toContain("frame-src 'none';");
    expect(policy).toContain("frame-ancestors 'none';");
    expect(policy).toContain("base-uri 'self';");
    expect(policy).toContain("form-action 'self';");
    expect(policy).toContain("connect-src 'self';");
  });
});

describe("security proxy", () => {
  it("forwards the same document nonce and CSP that it returns to the browser", () => {
    const response = proxy(new NextRequest("https://recall.ltd/"));
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    const responsePolicy = response.headers.get("content-security-policy");

    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(responsePolicy).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(responsePolicy);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });

  it("generates a distinct nonce for successive document responses", () => {
    const first = proxy(new NextRequest("https://recall.ltd/")).headers.get("content-security-policy");
    const second = proxy(new NextRequest("https://recall.ltd/")).headers.get("content-security-policy");

    expect(first).not.toBe(second);
  });

  it("preserves API CORS headers without applying a document CSP", () => {
    const response = proxy(new NextRequest("https://recall.ltd/api/bookmarks"));

    expect(response.headers.get("access-control-allow-origin")).toBe("https://recall.ltd");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("preserves API preflight behavior and baseline headers", () => {
    const response = proxy(new NextRequest("https://recall.ltd/api/bookmarks", { method: "OPTIONS" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("sets HSTS only when explicitly applying production headers", () => {
    const developmentHeaders = new Headers();
    const productionHeaders = new Headers();

    setBaselineSecurityHeaders(developmentHeaders, { isProduction: false });
    setBaselineSecurityHeaders(productionHeaders, { isProduction: true });

    expect(developmentHeaders.get("strict-transport-security")).toBeNull();
    expect(productionHeaders.get("strict-transport-security")).toBe("max-age=31536000");
  });

  it("excludes framework assets and prefetches from document nonce processing", () => {
    expect(JSON.stringify(config.matcher)).toContain("_next/static");
    expect(JSON.stringify(config.matcher)).toContain("_next/image");
    expect(JSON.stringify(config.matcher)).toContain("next-router-prefetch");
    expect(JSON.stringify(config.matcher)).toContain("purpose");
  });
});
