// ---- CONFIG ----
const PROD_URL = "https://recall.ltd";
const DEV_URL = "http://localhost:3030";

const app = document.getElementById("app");
let API_BASE = PROD_URL;
let pollTimer = null;

async function getConfig() {
  const data = await chrome.storage.local.get(["apiBase"]);
  API_BASE = data.apiBase || PROD_URL;
  return data;
}

function getSessionCookieName() {
  return API_BASE.startsWith("https")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

async function getSessionToken() {
  const cookie = await chrome.cookies.get({
    url: API_BASE,
    name: getSessionCookieName(),
  });
  return cookie?.value ?? null;
}

async function apiFetch(path, options = {}) {
  const token = await getSessionToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["X-Session-Token"] = token;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function init() {
  stopPolling();
  await getConfig();
  document.getElementById("settings-toggle").onclick = showSettings;

  const token = await getSessionToken();
  if (!token) { showSignIn(); return; }

  try {
    const res = await apiFetch("/api/collections");
    if (res.status === 401) { showSignIn(); return; }
    const collections = await res.json();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    showMain(tab, collections);
  } catch {
    showError("Could not connect to Recall.");
  }
}

function showSettings() {
  stopPolling();
  const isDev = API_BASE === DEV_URL;
  app.innerHTML = `
    <div class="setup">
      <div class="icon">⚙</div>
      <p>API Endpoint</p>
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <button class="env-btn ${!isDev ? 'active' : 'inactive'}" id="btn-prod">PROD</button>
        <button class="env-btn ${isDev ? 'active' : 'inactive'}" id="btn-dev">DEV</button>
      </div>
      <input type="text" class="token-input" id="api-url-input" value="${API_BASE}" />
      <button class="btn-primary" id="save-settings-btn">Save & Reconnect</button>
    </div>`;

  document.getElementById("btn-prod").addEventListener("click", () => {
    document.getElementById("api-url-input").value = PROD_URL;
  });
  document.getElementById("btn-dev").addEventListener("click", () => {
    document.getElementById("api-url-input").value = DEV_URL;
  });
  document.getElementById("save-settings-btn").addEventListener("click", async () => {
    const url = document.getElementById("api-url-input").value.trim().replace(/\/+$/, "");
    if (!url) return;
    await chrome.storage.local.set({ apiBase: url });
    API_BASE = url;
    init();
  });
}

function showSignIn() {
  app.innerHTML = `
    <div class="setup">
      <div class="icon">🔒</div>
      <p>Sign in to Recall to get started.</p>
      <button class="btn-primary" id="signin-btn">Sign in with Google</button>
      <button class="btn-secondary" id="check-btn" style="margin-top:8px;">I've signed in — check again</button>
    </div>`;

  document.getElementById("signin-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: API_BASE });
  });
  document.getElementById("check-btn").addEventListener("click", () => init());

  pollTimer = setInterval(async () => {
    const token = await getSessionToken();
    if (token) init();
  }, 2000);
}

function showError(msg) {
  stopPolling();
  app.innerHTML = `<div class="status error" style="padding:40px 20px;">${msg}</div>`;
}

function showMain(tab, collections) {
  stopPolling();
  const isDev = API_BASE === DEV_URL;
  const envClass = isDev ? "dev" : "prod";
  const envLabel = isDev ? "DEV" : "PROD";

  const options = collections.map(
    (c) => `<option value="${c.id}">${c.name} (${c.bookmarkCount})</option>`
  ).join("");

  const colList = collections.map(
    (c) => `<div class="col-item">
      <span class="name">${escapeHtml(c.name)} <span class="count">${c.bookmarkCount}</span></span>
      <button class="action-btn" data-id="${c.id}" data-name="${escapeAttr(c.name)}">Recall</button>
    </div>`
  ).join("");

  app.innerHTML = `
    <div style="padding:6px 16px 0;text-align:right;">
      <span class="env-badge ${envClass}">${envLabel}</span>
    </div>
    <div class="current-tab">
      <div class="label">Current Tab</div>
      <input type="text" class="title-input" id="title-input" value="${escapeAttr(tab.title || "Untitled")}" />
      <div class="url">${escapeHtml(tab.url || "")}</div>
    </div>
    <div class="form">
      <label>Collection</label>
      <select id="collection-select">
        ${options}
      </select>
      <button class="btn-primary" id="save-btn">Save Bookmark</button>
    </div>
    <div id="status"></div>
    ${collections.length > 0 ? `
      <div class="section">
        <div class="section-label">Recall Groups</div>
        ${colList}
      </div>` : ""}
    <div id="tab-groups-section"></div>`;

  // Save
  document.getElementById("save-btn").addEventListener("click", async () => {
    const btn = document.getElementById("save-btn");
    const select = document.getElementById("collection-select");
    btn.disabled = true;
    btn.textContent = "Saving...";
    try {
      const res = await apiFetch("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          title: document.getElementById("title-input").value.trim() || tab.url,
          url: tab.url,
          collectionId: select.value ? parseInt(select.value) : null,
        }),
      });
      if (res.ok) {
        document.getElementById("status").innerHTML = `<div class="status success">✓ Saved</div>`;
        btn.textContent = "Saved!";
        setTimeout(() => { btn.textContent = "Save Bookmark"; btn.disabled = false; }, 2000);
      } else if (res.status === 409) {
        document.getElementById("status").innerHTML = `<div class="status error">Already saved in this collection</div>`;
        btn.disabled = false;
        btn.textContent = "Save Bookmark";
      } else { throw new Error(); }
    } catch {
      document.getElementById("status").innerHTML = `<div class="status error">Failed to save</div>`;
      btn.disabled = false;
      btn.textContent = "Save Bookmark";
    }
  });

  // Open as tab group
  document.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const colId = btn.dataset.id;
      const name = btn.dataset.name;
      btn.textContent = "...";
      try {
        const res = await apiFetch(`/api/bookmarks?collectionId=${colId}`);
        if (res.ok) {
          const bms = await res.json();
          const urls = bms.map((b) => b.url);
          if (urls.length > 0) chrome.runtime.sendMessage({ type: "OPEN_TAB_GROUP", urls, name });
        }
      } catch {}
      btn.textContent = "Open";
    });
  });

  // Chrome tab groups
  chrome.runtime.sendMessage({ type: "GET_TAB_GROUPS" }, (tabGroups) => {
    const section = document.getElementById("tab-groups-section");
    if (!tabGroups || tabGroups.length === 0) return;

    const items = tabGroups.map((g) => `
      <div class="col-item">
        <span class="name">
          <span style="width:8px;height:8px;border-radius:50%;background:${chromeColorToHex(g.color)};display:inline-block;"></span>
          ${escapeHtml(g.title)} <span class="count">${g.tabs.length}</span>
        </span>
        <button class="action-btn save-group-btn" data-group='${escapeAttr(JSON.stringify(g))}'>Snap</button>
      </div>
    `).join("");

    section.innerHTML = `
      <div class="section">
        <div class="section-label">Snap Groups</div>
        ${items}
      </div>`;

    section.querySelectorAll(".save-group-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const group = JSON.parse(btn.dataset.group);
        btn.textContent = "...";
        btn.disabled = true;
        try {
          const colRes = await apiFetch("/api/collections", {
            method: "POST",
            body: JSON.stringify({ name: group.title }),
          });
          if (!colRes.ok) throw new Error();
          const { id: colId } = await colRes.json();
          for (const t of group.tabs) {
            if (!t.url || t.url.startsWith("chrome://")) continue;
            await apiFetch("/api/bookmarks", {
              method: "POST",
              body: JSON.stringify({ title: t.title || t.url, url: t.url, collectionId: colId }),
            });
          }
          btn.textContent = "✓";
        } catch {
          btn.textContent = "Fail";
          btn.disabled = false;
        }
      });
    });
  });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function chromeColorToHex(color) {
  const m = { grey:"#71717a", blue:"#2563eb", red:"#dc2626", yellow:"#ca8a04", green:"#16a34a", pink:"#db2777", purple:"#9333ea", cyan:"#0891b2", orange:"#ea580c" };
  return m[color] || "#a1a1aa";
}

init();
