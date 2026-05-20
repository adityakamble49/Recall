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
