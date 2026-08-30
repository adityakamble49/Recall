export const PROD_URL = "https://recall.ltd";
export const DEV_URL = "http://localhost:3030";

const ALLOWED_API_BASES = new Set([PROD_URL, DEV_URL]);

export function isAllowedApiBase(value) {
  return ALLOWED_API_BASES.has(value);
}
