import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpRequest, type IncomingHttpHeaders, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";

export const MAX_REDIRECTS = 5;
export const MAX_RESPONSE_BYTES = 256 * 1024;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type SafeHttpResponse = {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
};

export type SafeHttpDependencies = {
  resolveAddresses: (hostname: string) => Promise<ResolvedAddress[]>;
  request: (url: URL, addresses: ResolvedAddress[], signal: AbortSignal) => Promise<SafeHttpResponse>;
};

function normalizedHostname(hostname: string): string {
  const withoutBrackets = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  return withoutBrackets.replace(/\.+$/, "").toLowerCase();
}

export function isPublicIpAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()) {
      parsed = parsed.toIPv4Address();
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

export function parsePublicHttpUrl(value: string | URL, base?: URL): URL {
  const url = value instanceof URL ? new URL(value) : new URL(value, base);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported protocol");
  }
  if (url.username || url.password) throw new Error("URL credentials are not allowed");

  const hostname = normalizedHostname(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Local hostnames are not allowed");
  }
  if (ipaddr.isValid(hostname) && !isPublicIpAddress(hostname)) {
    throw new Error("Non-public IP address");
  }
  return url;
}

export async function resolvePublicAddresses(hostname: string): Promise<ResolvedAddress[]> {
  const normalized = normalizedHostname(hostname);
  if (ipaddr.isValid(normalized)) {
    if (!isPublicIpAddress(normalized)) throw new Error("Non-public IP address");
    const parsed = ipaddr.parse(normalized);
    return [{ address: normalized, family: parsed.kind() === "ipv4" ? 4 : 6 }];
  }

  const results = await dnsLookup(normalized, { all: true, verbatim: true });
  const addresses = results.map(({ address, family }) => ({
    address,
    family: family === 6 ? 6 as const : 4 as const,
  }));

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("Hostname did not resolve exclusively to public addresses");
  }

  return addresses.filter((entry, index) =>
    addresses.findIndex((candidate) => candidate.address === entry.address && candidate.family === entry.family) === index
  );
}

export function createPinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const family = options.family === 4 || options.family === 6 ? options.family : 0;
    const eligible = family === 0 ? addresses : addresses.filter((address) => address.family === family);
    if (eligible.length === 0) {
      const error = Object.assign(new Error("No validated address for requested family"), { code: "ENOTFOUND" });
      callback(error, "", 0);
      return;
    }
    if (options.all) {
      callback(null, eligible);
      return;
    }
    callback(null, eligible[0].address, eligible[0].family);
  };
}

export function createPinnedRequestOptions(
  url: URL,
  addresses: ResolvedAddress[],
  signal: AbortSignal,
): RequestOptions {
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("Refusing unvalidated address");
  }

  return {
    protocol: url.protocol,
    hostname: normalizedHostname(url.hostname),
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    agent: false,
    signal,
    lookup: createPinnedLookup(addresses),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; RecallBot/1.0; +https://recall.ltd)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Encoding": "identity",
    },
  };
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function requestPinnedUrl(
  url: URL,
  addresses: ResolvedAddress[],
  signal: AbortSignal,
): Promise<SafeHttpResponse> {
  const requestOptions = createPinnedRequestOptions(url, addresses, signal);

  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    const req = request(requestOptions, (response) => {
      const statusCode = response.statusCode ?? 0;
      const headers = response.headers;
      const isRedirect = REDIRECT_STATUSES.has(statusCode) && Boolean(firstHeader(headers.location));
      const contentType = firstHeader(headers["content-type"]) ?? "";
      const contentEncoding = (firstHeader(headers["content-encoding"]) ?? "identity").toLowerCase();
      const shouldReadBody = !isRedirect
        && statusCode >= 200
        && statusCode < 300
        && /(?:text\/html|application\/xhtml\+xml)/i.test(contentType)
        && contentEncoding === "identity";

      if (!shouldReadBody) {
        response.resume();
        finish(() => resolve({ statusCode, headers, body: "" }));
        return;
      }

      const contentLength = Number(firstHeader(headers["content-length"]));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        response.destroy();
        finish(() => reject(new Error("Response body exceeded limit")));
        return;
      }

      const chunks: Buffer[] = [];
      let received = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        received += buffer.length;
        if (received > MAX_RESPONSE_BYTES) {
          response.destroy();
          finish(() => reject(new Error("Response body exceeded limit")));
          return;
        }
        chunks.push(buffer);
        const html = Buffer.concat(chunks).toString("utf8");
        if (/<\/title>/i.test(html)) {
          response.destroy();
          finish(() => resolve({ statusCode, headers, body: html }));
        }
      });
      response.on("end", () => finish(() => resolve({
        statusCode,
        headers,
        body: Buffer.concat(chunks).toString("utf8"),
      })));
      response.on("error", (error) => finish(() => reject(error)));
    });

    req.on("error", (error) => finish(() => reject(error)));
    req.end();
  });
}

export async function fetchPublicHtml(
  value: string,
  signal: AbortSignal,
  dependencies: SafeHttpDependencies = {
    resolveAddresses: resolvePublicAddresses,
    request: requestPinnedUrl,
  },
): Promise<string> {
  let url = parsePublicHttpUrl(value);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    signal.throwIfAborted();
    const addresses = await dependencies.resolveAddresses(normalizedHostname(url.hostname));
    signal.throwIfAborted();
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
      throw new Error("Hostname did not resolve exclusively to public addresses");
    }

    const response = await dependencies.request(url, addresses, signal);
    const location = firstHeader(response.headers.location);
    if (REDIRECT_STATUSES.has(response.statusCode) && location) {
      if (redirects === MAX_REDIRECTS) throw new Error("Too many redirects");
      url = parsePublicHttpUrl(location, url);
      continue;
    }

    const contentType = firstHeader(response.headers["content-type"]) ?? "";
    const contentEncoding = (firstHeader(response.headers["content-encoding"]) ?? "identity").toLowerCase();
    if (
      response.statusCode < 200
      || response.statusCode >= 300
      || !/(?:text\/html|application\/xhtml\+xml)/i.test(contentType)
      || contentEncoding !== "identity"
    ) {
      throw new Error("Response is not supported HTML");
    }
    return response.body;
  }

  throw new Error("Too many redirects");
}
