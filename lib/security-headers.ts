const GOOGLE_IMAGE_SOURCES = [
  "https://www.google.com",
  "https://*.gstatic.com",
];

export function createCspNonce(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function buildContentSecurityPolicy(
  nonce: string,
  { isDevelopment = false }: { isDevelopment?: boolean } = {},
): string {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ];
  const connectSources = [
    "'self'",
    ...(isDevelopment ? ["ws:", "wss:"] : []),
  ];

  const directives = [
    ["default-src", "'self'"],
    ["script-src", ...scriptSources],
    ["script-src-attr", "'none'"],
    ["style-src", "'self'", `'nonce-${nonce}'`],
    ["style-src-attr", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:", ...GOOGLE_IMAGE_SOURCES],
    ["font-src", "'self'"],
    ["connect-src", ...connectSources],
    ["media-src", "'self'"],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ...(!isDevelopment ? [["upgrade-insecure-requests"]] : []),
  ];

  return directives.map((directive) => `${directive.join(" ")};`).join(" ");
}

export function setBaselineSecurityHeaders(headers: Headers, { isProduction }: { isProduction: boolean }) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-XSS-Protection", "0");
  if (isProduction) {
    headers.set("Strict-Transport-Security", "max-age=31536000");
  }
}
