// ---- CONFIG ----
const PROD_URL = "https://recall.ltd";
const DEV_URL = "http://localhost:3030";

const app = document.getElementById("app");
let API_BASE = PROD_URL;

async function getConfig() {
  const data = await chrome.storage.local.get(["token", "apiBase"]);
  API_BASE = data.apiBase || PROD_URL;
  return data;
}

async function apiFetch(path, options = {}) {
  const { token } = await chrome.storage.local.get("token");
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

async function init() {
  const { token } = await getConfig();
  document.getElementById("settings-toggle").onclick = showSettings;

  if (!token) { showSetup(); return; }

  try {
    const res = await apiFetch("/api/collections");
    if (res.status === 401) { showSetup("Token expired or invalid."); return; }
    const collections = await res.json();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    showMain(tab, collections);
  } catch {
    showError("Could not connect to Recall.");
  }
}

function showSettings() {
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

function showSetup(message) {
  app.innerHTML = `
    <div class="setup">
      <div class="icon">🔑</div>
      <p>${message || "Connect your Recall account.<br>Go to Settings → Chrome Extension to get your token."}</p>
      <input type="text" class="token-input" id="token-input" placeholder="Paste token here" />
      <button class="btn-primary" id="connect-btn">Connect</button>
      <br><br>
      <a href="${API_BASE}/settings" target="_blank">Open Recall Settings →</a>
    </div>`;

  document.getElementById("connect-btn").addEventListener("click", async () => {
    const input = document.getElementById("token-input");
    const val = input.value.trim();
    if (!val) return;
    try {
      const res = await fetch(`${API_BASE}/api/collections`, {
        headers: { "Authorization": `Bearer ${val}` },
      });
      if (res.ok) {
        await chrome.storage.local.set({ token: val });
        init();
      } else {
        input.style.borderColor = "#dc2626";
        input.placeholder = "Invalid token";
        input.value = "";
      }
    } catch {
      showError("Could not connect to Recall.");
    }
  });
}

function showError(msg) {
  app.innerHTML = `<div class="status error" style="padding:40px 20px;">${msg}</div>`;
}

function showMain(tab, collections) {
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
    <div id="tab-groups-section"></div>
    <div class="disconnect">
      <button id="disconnect-btn">Disconnect</button>
    </div>`;

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

  // Disconnect
  document.getElementById("disconnect-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove("token");
    init();
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
