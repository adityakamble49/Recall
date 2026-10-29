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

export function validateBookmarkFields(data: { title?: unknown; url?: unknown; description?: unknown }): { valid: boolean; error?: string } {
  for (const field of ["title", "url", "description"] as const) {
    if (data[field] != null && typeof data[field] !== "string") {
      return { valid: false, error: `${field} must be a string` };
    }
  }
  const { title, url, description } = data as { title?: string | null; url?: string | null; description?: string | null };
  if (title != null && title.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: `Title must not exceed ${MAX_TITLE_LENGTH} characters` };
  }
  if (description != null && description.length > MAX_DESCRIPTION_LENGTH) {
    return { valid: false, error: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters` };
  }
  if (url != null) {
    return validateBookmarkUrl(url);
  }
  return { valid: true };
}

type FieldResult<T> = { valid: true; value: T } | { valid: false; error: string };

export function validateBookmarkTitle(title: unknown): FieldResult<string> {
  if (typeof title !== "string") return { valid: false, error: "Title is required" };
  const trimmed = title.trim();
  if (!trimmed) return { valid: false, error: "Title is required" };
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: `Title must not exceed ${MAX_TITLE_LENGTH} characters` };
  }
  return { valid: true, value: trimmed };
}

export const MAX_COLLECTION_NAME_LENGTH = 100;
const MAX_COLLECTION_DESCRIPTION_LENGTH = 500;
const COLLECTION_ICON_PATTERN = /^[a-z0-9-]{1,32}$/;
const COLLECTION_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type CollectionFields = { name?: string; description?: string; icon?: string; color?: string };

/**
 * Validates client-supplied collection fields and returns only the allowed,
 * normalized ones. Unknown keys (userId, isDefault, ...) are dropped.
 */
export function validateCollectionFields(data: unknown, options: { requireName: true }): FieldResult<CollectionFields & { name: string }>;
export function validateCollectionFields(data: unknown, options: { requireName: false }): FieldResult<CollectionFields>;
export function validateCollectionFields(data: unknown, { requireName }: { requireName: boolean }): FieldResult<CollectionFields> {
  if (typeof data !== "object" || data === null) return { valid: false, error: "Invalid collection" };
  const input = data as Record<string, unknown>;
  const value: CollectionFields = {};

  if (input.name === undefined) {
    if (requireName) return { valid: false, error: "Collection name is required" };
  } else {
    if (typeof input.name !== "string" || !input.name.trim()) {
      return { valid: false, error: "Collection name is required" };
    }
    const name = input.name.trim();
    if (name.length > MAX_COLLECTION_NAME_LENGTH) {
      return { valid: false, error: `Collection name must not exceed ${MAX_COLLECTION_NAME_LENGTH} characters` };
    }
    value.name = name;
  }

  if (input.description != null) {
    if (typeof input.description !== "string" || input.description.length > MAX_COLLECTION_DESCRIPTION_LENGTH) {
      return { valid: false, error: `Description must not exceed ${MAX_COLLECTION_DESCRIPTION_LENGTH} characters` };
    }
    value.description = input.description;
  }
  if (input.icon != null) {
    if (typeof input.icon !== "string" || !COLLECTION_ICON_PATTERN.test(input.icon)) {
      return { valid: false, error: "Invalid collection icon" };
    }
    value.icon = input.icon;
  }
  if (input.color != null) {
    if (typeof input.color !== "string" || !COLLECTION_COLOR_PATTERN.test(input.color)) {
      return { valid: false, error: "Collection color must be a hex color like #4343d5" };
    }
    value.color = input.color;
  }

  return { valid: true, value };
}

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}
