import { fetchPublicHtml } from "@/lib/safe-http";

const TITLE_FETCH_TIMEOUT_MS = 5000;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TITLE_FETCH_TIMEOUT_MS);
  try {
    const html = await Promise.race([
      fetchPublicHtml(url, controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new Error("Title fetch timed out")), { once: true });
      }),
    ]);

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
