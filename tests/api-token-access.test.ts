import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedApiTokenEmails, isApiTokenEmailAllowed } from "@/lib/api-token-access";

describe("personal API token email allowlist", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses, trims and lowercases entries, dropping invalid ones", () => {
    expect(allowedApiTokenEmails(" Me@Example.com , ,not-an-email, other@example.org ")).toEqual([
      "me@example.com",
      "other@example.org",
    ]);
  });

  it("allows nobody when the variable is unset or empty", () => {
    vi.stubEnv("RECALL_API_TOKEN_EMAILS", "");
    expect(allowedApiTokenEmails()).toEqual([]);
    expect(isApiTokenEmailAllowed("me@example.com")).toBe(false);
  });

  it("reads RECALL_API_TOKEN_EMAILS by default", () => {
    vi.stubEnv("RECALL_API_TOKEN_EMAILS", "me@example.com");
    expect(isApiTokenEmailAllowed("ME@example.com ")).toBe(true);
  });

  it("matches exact addresses only", () => {
    const allowed = ["me@example.com"];
    expect(isApiTokenEmailAllowed("me@example.com", allowed)).toBe(true);
    expect(isApiTokenEmailAllowed("me+tag@example.com", allowed)).toBe(false);
    expect(isApiTokenEmailAllowed("m.e@example.com", allowed)).toBe(false);
    expect(isApiTokenEmailAllowed("me@example.com.evil", allowed)).toBe(false);
  });

  it.each([null, undefined, "", "   "])("never allows a missing email (%j)", (email) => {
    expect(isApiTokenEmailAllowed(email, ["me@example.com"])).toBe(false);
  });
});
