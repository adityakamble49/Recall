// Personal API tokens are available only to accounts whose email is listed in
// RECALL_API_TOKEN_EMAILS (comma-separated). Unset or empty means nobody.

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function allowedApiTokenEmails(value = process.env.RECALL_API_TOKEN_EMAILS): string[] {
  return (value ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter((email) => /^[^\s@]+@[^\s@]+$/.test(email));
}

export function isApiTokenEmailAllowed(
  email: string | null | undefined,
  allowedEmails = allowedApiTokenEmails(),
): boolean {
  if (typeof email !== "string" || !email.trim()) return false;
  return allowedEmails.includes(normalizeEmail(email));
}
