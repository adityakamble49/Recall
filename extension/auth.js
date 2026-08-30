const TOKEN_KEY = "extensionCredential";
const TOKEN_PATTERN = /^recall_ext_[a-f0-9]{32}\.[A-Za-z0-9_-]{43}$/;

export class ExtensionAuthorizationError extends Error {}

export async function protectCredentialStorage() {
  if (typeof chrome.storage.local.setAccessLevel !== "function") return;
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export async function getStoredCredential() {
  const data = await chrome.storage.local.get([TOKEN_KEY]);
  const credential = data[TOKEN_KEY];
  if (!credential
    || typeof credential.accessToken !== "string"
    || !TOKEN_PATTERN.test(credential.accessToken)
    || typeof credential.expiresAt !== "string"
    || Date.parse(credential.expiresAt) <= Date.now()) {
    await clearStoredCredential();
    return null;
  }
  return credential;
}

export async function authorizeExtension(apiBase) {
  const redirectUri = chrome.identity.getRedirectURL("recall-auth");
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(32);
  const codeChallenge = await sha256Base64Url(codeVerifier);
  const authorizeUrl = new URL(`${apiBase}/extension/authorize`);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const resultUrl = await chrome.identity.launchWebAuthFlow({
    url: authorizeUrl.toString(),
    interactive: true,
  });
  if (!resultUrl) throw new ExtensionAuthorizationError("Authorization was cancelled");

  const callback = new URL(resultUrl);
  const expectedRedirect = new URL(redirectUri);
  if (callback.origin !== expectedRedirect.origin || callback.pathname !== expectedRedirect.pathname) {
    throw new ExtensionAuthorizationError("Authorization returned to an invalid destination");
  }
  if (callback.searchParams.get("state") !== state) {
    throw new ExtensionAuthorizationError("Authorization state did not match");
  }
  if (callback.searchParams.get("error")) {
    throw new ExtensionAuthorizationError("Authorization was declined");
  }
  const code = callback.searchParams.get("code");
  if (!code) throw new ExtensionAuthorizationError("Authorization code was missing");

  const response = await fetch(`${apiBase}/api/extension/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) throw new ExtensionAuthorizationError("Could not complete authorization");
  const data = await response.json();
  if (!TOKEN_PATTERN.test(data?.access_token) || typeof data?.expires_at !== "string") {
    throw new ExtensionAuthorizationError("Server returned an invalid credential");
  }

  const credential = { accessToken: data.access_token, expiresAt: data.expires_at };
  await protectCredentialStorage();
  await chrome.storage.local.set({ [TOKEN_KEY]: credential });
  return credential;
}

export async function authorizedFetch(apiBase, path, options = {}) {
  const credential = await getStoredCredential();
  if (!credential) throw new ExtensionAuthorizationError("Extension is not connected");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    Authorization: `Bearer ${credential.accessToken}`,
  };
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (response.status === 401) await clearStoredCredential();
  return response;
}

export async function disconnectExtension(apiBase) {
  const credential = await getStoredCredential();
  if (credential) {
    try {
      await fetch(`${apiBase}/api/extension/token`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      });
    } catch {}
  }
  await clearStoredCredential();
}

export async function clearStoredCredential() {
  await chrome.storage.local.remove([TOKEN_KEY]);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function randomBase64Url(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
