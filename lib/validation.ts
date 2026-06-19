const ALLOWED_PROTOCOLS = ["http:", "https:"];
const MAX_URL_LENGTH = 2048;
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 2000;

export function validateBookmarkUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.length > MAX_URL_LENGTH) {
    return { valid: false, error: `URL must be between 1 and ${MAX_URL_LENGTH} characters` };
  }
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: "URL must use http or https protocol" };
    }
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
  return { valid: true };
}

export function validateBookmarkFields(data: { title?: string; url?: string; description?: string }): { valid: boolean; error?: string } {
  if (data.title !== undefined && data.title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: `Title must not exceed ${MAX_TITLE_LENGTH} characters` };
  }
  if (data.description !== undefined && data.description.length > MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` };
  }
  if (data.url !== undefined) {
    return validateBookmarkUrl(data.url);
  }
  return { valid: true };
}

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

// Best-effort SSRF guard: an http/https URL whose host is not a private/loopback/
// link-local literal. This blocks obvious internal targets before a server-side fetch.
// It is NOT full protection — a public hostname that resolves to a private IP (DNS
// rebinding) would still pass. That's an accepted limitation for this app.
export function isPublicHttpUrl(url: string): boolean {
  if (!isSafeUrl(url)) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  // Strip IPv6 brackets if present
  const h = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;

  if (h === "localhost" || h.endsWith(".localhost")) return false;
  if (h === "::1" || h === "0.0.0.0") return false;

  // IPv4 literal private/loopback/link-local ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1]), parseInt(m[2])];
    if (a === 127) return false;                    // loopback
    if (a === 10) return false;                     // private
    if (a === 192 && b === 168) return false;       // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 169 && b === 254) return false;       // link-local (incl. metadata)
    if (a === 0) return false;
  }
  return true;
}
