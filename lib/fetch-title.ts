import { isPublicHttpUrl } from "@/lib/validation";

const TITLE_FETCH_TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024; // title lives in <head>, near the top
const MAX_TITLE_LENGTH = 500; // mirror lib/validation MAX_TITLE_LENGTH

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " ",
};

function decodeEntities(str: string): string {
  return str.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (lower[0] === "#") {
      const num = lower[1] === "x" ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return Number.isNaN(num) ? match : String.fromCodePoint(num);
    }
    return ENTITIES[lower] ?? match;
  });
}

// Fetch a URL server-side and extract its <title>. Returns null on any failure
// (unsafe/private URL, timeout, non-HTML, no title) — never throws.
export async function fetchPageTitle(url: string): Promise<string | null> {
  if (!isPublicHttpUrl(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITLE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RecallBot/1.0; +https://recall.ltd)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;

    // Read only the first chunk — the <title> is in <head>, near the top.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder();
    let html = "";
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      html += decoder.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break; // got the closing tag, no need to read more
    }
    reader.cancel().catch(() => {});

    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!match) return null;
    const title = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
    if (!title) return null;
    return title.slice(0, MAX_TITLE_LENGTH);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
