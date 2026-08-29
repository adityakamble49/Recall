import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPublicHtml: vi.fn(),
}));

vi.mock("@/lib/safe-http", () => ({ fetchPublicHtml: mocks.fetchPublicHtml }));

import { fetchPageTitle } from "@/lib/fetch-title";

describe("fetchPageTitle", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("extracts, decodes, normalizes, and truncates a page title", async () => {
    mocks.fetchPublicHtml.mockResolvedValue(`<html><title>  Recall &amp; ${"A".repeat(600)}  </title></html>`);

    const title = await fetchPageTitle("https://example.com");

    expect(title?.startsWith("Recall & ")).toBe(true);
    expect(title).toHaveLength(500);
  });

  it("returns null when the safe transport rejects the URL", async () => {
    mocks.fetchPublicHtml.mockRejectedValue(new Error("Blocked"));

    await expect(fetchPageTitle("http://127.0.0.1")).resolves.toBeNull();
  });

  it("returns null after the global timeout", async () => {
    vi.useFakeTimers();
    mocks.fetchPublicHtml.mockImplementation((_url: string, signal: AbortSignal) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
    }));

    const result = fetchPageTitle("https://example.com");
    await vi.advanceTimersByTimeAsync(5_000);

    await expect(result).resolves.toBeNull();
  });
});
