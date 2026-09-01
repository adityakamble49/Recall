export function getExtensionConfig() {
  const manifest = chrome.runtime.getManifest();
  const permissions = manifest.host_permissions;
  if (!Array.isArray(permissions) || permissions.length !== 1) {
    throw new Error("Extension must declare exactly one API host");
  }

  const pattern = permissions[0];
  if (typeof pattern !== "string" || !pattern.endsWith("/*")) {
    throw new Error("Extension API host permission is invalid");
  }

  const apiBase = pattern.slice(0, -2);
  const parsed = new URL(apiBase);
  if (!(["http:", "https:"].includes(parsed.protocol))
    || parsed.pathname !== "/"
    || parsed.search
    || parsed.hash
    || parsed.username
    || parsed.password) {
    throw new Error("Extension API origin is invalid");
  }

  return Object.freeze({
    apiBase: parsed.origin,
    isDevelopment: typeof manifest.name === "string" && manifest.name.endsWith(" (DEV)"),
  });
}
