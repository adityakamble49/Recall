// ---- CONFIG ----
const PROD_URL = "https://recall-ebon.vercel.app";
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

  // Settings gear handler
  document.getElementById("settings-toggle").onclick = showSettings;

  if (!token) {
    showSetup();
    return;
  }

  try {
    const res = await apiFetch("/api/collections");
    if (res.status === 401) {
      showSetup("Token expired or invalid. Please reconnect.");
      return;
    }
    const collections = await res.json();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    showMain(tab, collections);
  } catch {
    showError("Could not connect to Recall. Check your API URL in settings.");
  }
}

function showSettings() {
  const isDev = API_BASE === DEV_URL;
  app.innerHTML = `
    <div class="setup">
      <span class="material-symbols-outlined icon">settings</span>
      <p>Configure API endpoint</p>
      <div style="display:flex;gap:6px;margin-bottom:12px;">
        <button class="env-btn" id="btn-prod" style="flex:1;padding:10px;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.1s;
          ${!isDev ? 'background:#4343d5;color:white;border:none;' : 'background:#f5f2fe;color:#1b1b23;border:2px solid #e4e1ed;'}">
          PROD
        </button>
        <button class="env-btn" id="btn-dev" style="flex:1;padding:10px;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.1s;
          ${isDev ? 'background:#4343d5;color:white;border:none;' : 'background:#f5f2fe;color:#1b1b23;border:2px solid #e4e1ed;'}">
          DEV
        </button>
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
      <span class="material-symbols-outlined icon">key</span>
      <p>${message || "Connect your Recall account.<br>Go to Settings → Chrome Extension to get your token."}</p>
      <input type="text" class="token-input" id="token-input" placeholder="Paste your token here" />
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
        input.style.borderColor = "#ba1a1a";
        input.placeholder = "Invalid token";
        input.value = "";
      }
    } catch {
      showError("Could not connect to Recall. Check your API URL in settings.");
    }
  });
}

function showError(msg) {
  app.innerHTML = `<div class="status error">${msg}</div>`;
}

function showMain(tab, collections) {
  const envLabel = API_BASE === DEV_URL ? "DEV" : "PROD";
  const envColor = API_BASE === DEV_URL ? "#b65700" : "#4343d5";

  const options = collections.map(
    (c) => `<option value="${c.id}">${c.name} (${c.bookmarkCount})</option>`
  ).join("");

  const colList = collections.map(
    (c) => `<div class="col-item">
      <span class="name">${c.name} (${c.bookmarkCount})</span>
      <button class="open-btn" data-id="${c.id}" data-name="${c.name}">Open Group</button>
    </div>`
  ).join("");

  app.innerHTML = `
    <div style="padding:4px 20px 0;text-align:right;">
      <span style="font-size:9px;font-weight:800;color:${envColor};background:${envColor}15;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.05em;">${envLabel}</span>
    </div>
    <div class="current-tab">
      <div class="label">Current Tab</div>
      <input type="text" id="title-input" value="${escapeAttr(tab.title || "Untitled")}" style="width:100%;font-size:13px;font-weight:700;background:transparent;border:none;border-bottom:2px solid transparent;padding:2px 0;font-family:inherit;color:#1b1b23;outline:none;" onfocus="this.style.borderBottomColor='#4343d5'" onblur="this.style.borderBottomColor='transparent'" />
      <div class="url">${escapeHtml(tab.url || "")}</div>
    </div>
    <div class="form">
      <label>Save to Collection</label>
      <select id="collection-select">
        <option value="">General (no collection)</option>
        ${options}
      </select>
      <button class="btn-primary" id="save-btn">Save Bookmark</button>
    </div>
    <div id="status"></div>
    ${collections.length > 0 ? `
      <div class="collections">
        <div class="section-label">Open as Tab Group</div>
        ${colList}
      </div>` : ""}
    <div class="disconnect">
      <button id="disconnect-btn">Disconnect account</button>
    </div>`;

  // Save handler
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
        document.getElementById("status").innerHTML = `<div class="status success">✓ Saved!</div>`;
        btn.textContent = "Saved!";
        setTimeout(() => { btn.textContent = "Save Bookmark"; btn.disabled = false; }, 2000);
      } else if (res.status === 409) {
        document.getElementById("status").innerHTML = `<div class="status error">Already saved in this collection.</div>`;
        btn.disabled = false;
        btn.textContent = "Save Bookmark";
      } else {
        throw new Error();
      }
    } catch {
      document.getElementById("status").innerHTML = `<div class="status error">Failed to save.</div>`;
      btn.disabled = false;
      btn.textContent = "Save Bookmark";
    }
  });

  // Open as tab group handlers
  document.querySelectorAll(".open-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const colId = btn.dataset.id;
      const name = btn.dataset.name;
      btn.textContent = "Opening...";
      try {
        const res = await apiFetch(`/api/bookmarks?collectionId=${colId}`);
        if (res.ok) {
          const bms = await res.json();
          const urls = bms.map((b) => b.url);
          if (urls.length > 0) {
            chrome.runtime.sendMessage({ type: "OPEN_TAB_GROUP", urls, name });
          }
        }
      } catch { /* ignore */ }
      btn.textContent = "Open Group";
    });
  });

  // Disconnect handler
  document.getElementById("disconnect-btn").addEventListener("click", async () => {
    await chrome.storage.local.remove("token");
    init();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

init();
