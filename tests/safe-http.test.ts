import type { LookupAddress, LookupOptions } from "node:dns";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_REDIRECTS,
  createPinnedRequestOptions,
  fetchPublicHtml,
  isPublicIpAddress,
  parsePublicHttpUrl,
  type SafeHttpDependencies,
  type SafeHttpResponse,
} from "@/lib/safe-http";

const PUBLIC_ADDRESS = { address: "93.184.216.34", family: 4 as const };

function response(
  statusCode: number,
  headers: SafeHttpResponse["headers"],
  body = "",
): SafeHttpResponse {
  return { statusCode, headers, body };
}

function dependencies(
  request: SafeHttpDependencies["request"],
  resolveAddresses: SafeHttpDependencies["resolveAddresses"] = async () => [PUBLIC_ADDRESS],
): SafeHttpDependencies {
  return { request, resolveAddresses };
}

describe("public IP classification", () => {
  it.each([
    "8.8.8.8",
    "93.184.216.34",
    "2606:4700:4700::1111",
  ])("accepts globally routable address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });

  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("rejects non-public address %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });
});

describe("URL validation", () => {
  it.each([
    "http://localhost/admin",
    "http://service.localhost./admin",
    "http://127.0.0.1/admin",
    "http://[::1]/admin",
    "https://user:password@example.com/",
    "file:///etc/passwd",
  ])("rejects unsafe URL %s", (url) => {
    expect(() => parsePublicHttpUrl(url)).toThrow();
  });

  it("accepts a public HTTP URL", () => {
    expect(parsePublicHttpUrl("https://example.com/path").hostname).toBe("example.com");
  });
});

describe("pinned request options", () => {
  it("keeps the original hostname while returning only the validated address", async () => {
    const options = createPinnedRequestOptions(
      new URL("https://example.com/path?q=1"),
      [PUBLIC_ADDRESS],
      new AbortController().signal,
    );

    expect(options.hostname).toBe("example.com");
    expect(options.path).toBe("/path?q=1");
    expect(options.agent).toBe(false);

    const selected = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      options.lookup?.("example.com", { all: false } as LookupOptions, (error, address, family) => {
        if (error) return reject(error);
        if (Array.isArray(address)) {
          const first = address[0] as LookupAddress | undefined;
          if (!first) return reject(new Error("No address returned"));
          resolve(first);
          return;
        }
        resolve({ address, family: family ?? 0 });
      });
    });

    expect(selected).toEqual(PUBLIC_ADDRESS);
  });
});

describe("safe redirect handling", () => {
  it("follows a relative public redirect and returns HTML", async () => {
    const request = vi.fn<SafeHttpDependencies["request"]>()
      .mockResolvedValueOnce(response(302, { location: "/final" }))
      .mockResolvedValueOnce(response(200, { "content-type": "text/html" }, "<title>Safe</title>"));

    const html = await fetchPublicHtml(
      "https://example.com/start",
      new AbortController().signal,
      dependencies(request),
    );

    expect(html).toContain("<title>Safe</title>");
    expect(request.mock.calls[1][0].href).toBe("https://example.com/final");
  });

  it("blocks a redirect whose hostname resolves to a private address before requesting it", async () => {
    const request = vi.fn<SafeHttpDependencies["request"]>()
      .mockResolvedValueOnce(response(302, { location: "http://internal.example/admin" }));
    const resolveAddresses = vi.fn<SafeHttpDependencies["resolveAddresses"]>()
      .mockResolvedValueOnce([PUBLIC_ADDRESS])
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);

    await expect(fetchPublicHtml(
      "https://example.com/start",
      new AbortController().signal,
      dependencies(request, resolveAddresses),
    )).rejects.toThrow("public addresses");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects mixed public and private DNS answers", async () => {
    const request = vi.fn<SafeHttpDependencies["request"]>();
    const resolveAddresses = vi.fn<SafeHttpDependencies["resolveAddresses"]>()
      .mockResolvedValue([PUBLIC_ADDRESS, { address: "10.0.0.1", family: 4 }]);

    await expect(fetchPublicHtml(
      "https://example.com/",
      new AbortController().signal,
      dependencies(request, resolveAddresses),
    )).rejects.toThrow("public addresses");
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects redirect chains longer than the configured maximum", async () => {
    const request = vi.fn<SafeHttpDependencies["request"]>()
      .mockResolvedValue(response(302, { location: "/again" }));

    await expect(fetchPublicHtml(
      "https://example.com/start",
      new AbortController().signal,
      dependencies(request),
    )).rejects.toThrow("Too many redirects");
    expect(request).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
  });

  it.each([
    response(200, { "content-type": "application/json" }, "{}"),
    response(200, { "content-type": "text/html", "content-encoding": "gzip" }, "compressed"),
    response(404, { "content-type": "text/html" }, "<title>Missing</title>"),
  ])("rejects unsupported responses", async (unsupportedResponse) => {
    await expect(fetchPublicHtml(
      "https://example.com/",
      new AbortController().signal,
      dependencies(async () => unsupportedResponse),
    )).rejects.toThrow("not supported HTML");
  });
});
