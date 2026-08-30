import {
  authorizeExtension,
  authorizedFetch,
  disconnectExtension,
  getStoredCredential,
  protectCredentialStorage,
} from "./auth.js";

// ---- CONFIG ----
const PROD_URL = "https://recall.ltd";
const DEV_URL = "http://localhost:3030";

let API_BASE = PROD_URL;

function element(tagName, { id, className, text, type, title } = {}) {
  const node = document.createElement(tagName);
  if (id) node.id = id;
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  if (type) node.type = type;
  if (title) node.title = title;
  return node;
}

function getApp() {
  const app = document.getElementById("app");
  if (!app) throw new Error("Popup root not found");
  return app;
}

function normalizeCollections(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((collection) => {
    if (!collection || !Number.isSafeInteger(collection.id) || collection.id <= 0) return [];
    const count = Number(collection.bookmarkCount);
    return [{
      id: collection.id,
      name: typeof collection.name === "string" ? collection.name : "Untitled Collection",
      bookmarkCount: Number.isFinite(count) && count >= 0 ? count : 0,
    }];
  });
}

function normalizeTabGroups(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((group) => {
    if (!group || !Number.isSafeInteger(group.id)) return [];
    const tabs = Array.isArray(group.tabs)
      ? group.tabs.map((tab) => ({
        title: typeof tab?.title === "string" ? tab.title : "",
        url: typeof tab?.url === "string" ? tab.url : "",
      }))
      : [];
    return [{
      id: group.id,
      title: typeof group.title === "string" ? group.title : "Untitled Group",
      color: typeof group.color === "string" ? group.color : "grey",
      tabs,
    }];
  });
}

async function getConfig() {
  const data = await chrome.storage.local.get(["apiBase"]);
  API_BASE = typeof data.apiBase === "string" && data.apiBase ? data.apiBase : PROD_URL;
  return data;
}

async function apiFetch(path, options = {}) {
  return authorizedFetch(API_BASE, path, options);
}

export async function init() {
  await protectCredentialStorage();
  await getConfig();
  const settingsToggle = document.getElementById("settings-toggle");
  if (settingsToggle) settingsToggle.onclick = () => { void showSettings(); };

  const credential = await getStoredCredential();
  if (!credential) {
    showSignIn();
    return;
  }

  try {
    const response = await apiFetch("/api/collections");
    if (response.status === 401) {
      showSignIn();
      return;
    }
    if (!response.ok) throw new Error("Collections request failed");
    const collections = await response.json();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    showMain(tab, collections);
  } catch {
    showError("Could not connect to Recall.");
  }
}

export async function showSettings() {
  const isDev = API_BASE === DEV_URL;
  const setup = element("div", { className: "setup" });
  setup.append(
    element("div", { className: "icon", text: "⚙" }),
    element("p", { text: "API Endpoint" }),
  );

  const environmentButtons = element("div", { className: "env-toggle" });
  const prodButton = element("button", {
    id: "btn-prod",
    className: `env-btn ${isDev ? "inactive" : "active"}`,
    text: "PROD",
    type: "button",
  });
  const devButton = element("button", {
    id: "btn-dev",
    className: `env-btn ${isDev ? "active" : "inactive"}`,
    text: "DEV",
    type: "button",
  });
  environmentButtons.append(prodButton, devButton);

  const input = element("input", { id: "api-url-input", className: "token-input" });
  input.type = "text";
  input.value = API_BASE;
  const saveButton = element("button", {
    id: "save-settings-btn",
    className: "btn-primary",
    text: "Save & Reconnect",
    type: "button",
  });
  setup.append(environmentButtons, input, saveButton);
  const credential = await getStoredCredential();
  if (credential) {
    const disconnectButton = element("button", {
      id: "disconnect-extension-btn",
      className: "btn-secondary",
      text: "Disconnect Extension",
      type: "button",
    });
    setup.append(disconnectButton);
    disconnectButton.addEventListener("click", async () => {
      disconnectButton.disabled = true;
      await disconnectExtension(API_BASE);
      showSignIn();
    });
  }
  getApp().replaceChildren(setup);

  prodButton.addEventListener("click", () => { input.value = PROD_URL; });
  devButton.addEventListener("click", () => { input.value = DEV_URL; });
  saveButton.addEventListener("click", async () => {
    const url = input.value.trim().replace(/\/+$/, "");
    if (url !== PROD_URL && url !== DEV_URL) return;
    if (url === DEV_URL) {
      const granted = await chrome.permissions.request({ origins: [`${DEV_URL}/*`] });
      if (!granted) {
        saveButton.textContent = "Local access denied";
        return;
      }
    }
    await chrome.storage.local.set({ apiBase: url });
    API_BASE = url;
    await init();
  });
}

export function showSignIn() {
  const setup = element("div", { className: "setup" });
  const signInButton = element("button", {
    id: "signin-btn",
    className: "btn-primary",
    text: "Connect Recall",
    type: "button",
  });
  setup.append(
    element("div", { className: "icon", text: "🔒" }),
    element("p", { text: "Connect your Recall account to get started." }),
    signInButton,
  );
  getApp().replaceChildren(setup);

  signInButton.addEventListener("click", async () => {
    signInButton.disabled = true;
    signInButton.textContent = "Connecting...";
    try {
      await authorizeExtension(API_BASE);
      await init();
    } catch {
      signInButton.disabled = false;
      signInButton.textContent = "Try connecting again";
    }
  });
}

export function showError(message) {
  const status = element("div", { className: "status error", text: message });
  status.classList.add("standalone-status");
  getApp().replaceChildren(status);
}

function renderStatus(message, kind) {
  const container = document.getElementById("status");
  if (!container) return;
  container.replaceChildren(element("div", {
    className: `status ${kind === "success" ? "success" : "error"}`,
    text: message,
  }));
}

function createCollectionRow(collection) {
  const row = element("div", { className: "col-item" });
  const name = element("span", { className: "name", text: collection.name });
  name.append(element("span", { className: "count", text: collection.bookmarkCount }));
  const button = element("button", {
    className: "action-btn recall-btn",
    text: "Recall",
    type: "button",
  });
  row.append(name, button);

  button.addEventListener("click", async () => {
    button.textContent = "...";
    try {
      const response = await apiFetch(`/api/bookmarks?collectionId=${collection.id}`);
      if (response.ok) {
        const bookmarks = await response.json();
        const urls = Array.isArray(bookmarks)
          ? bookmarks.flatMap((bookmark) => typeof bookmark?.url === "string" ? [bookmark.url] : [])
          : [];
        if (urls.length > 0) {
          chrome.runtime.sendMessage({ type: "OPEN_TAB_GROUP", urls, name: collection.name });
        }
      }
    } catch {}
    button.textContent = "Open";
  });

  return row;
}

function createSnapRow(group) {
  const row = element("div", { className: "col-item" });
  const name = element("span", { className: "name" });
  const color = element("span", { className: "group-color" });
  color.style.backgroundColor = chromeColorToHex(group.color);
  name.append(
    color,
    document.createTextNode(group.title),
    element("span", { className: "count", text: group.tabs.length }),
  );
  const button = element("button", {
    className: "action-btn save-group-btn",
    text: "Snap",
    type: "button",
  });
  row.append(name, button);

  button.addEventListener("click", async () => {
    button.textContent = "...";
    button.disabled = true;
    try {
      const collectionResponse = await apiFetch("/api/collections", {
        method: "POST",
        body: JSON.stringify({ name: group.title }),
      });
      if (!collectionResponse.ok) throw new Error("Collection creation failed");
      const { id: collectionId } = await collectionResponse.json();
      for (const tab of group.tabs) {
        if (!tab.url || tab.url.startsWith("chrome://")) continue;
        await apiFetch("/api/bookmarks", {
          method: "POST",
          body: JSON.stringify({
            title: tab.title || tab.url,
            url: tab.url,
            collectionId,
          }),
        });
      }
      button.textContent = "✓";
    } catch {
      button.textContent = "Fail";
      button.disabled = false;
    }
  });

  return row;
}

function renderTabGroups(container, value) {
  const tabGroups = normalizeTabGroups(value);
  if (tabGroups.length === 0) {
    container.replaceChildren();
    return;
  }
  const section = element("div", { className: "section" });
  section.append(element("div", { className: "section-label", text: "Snap Groups" }));
  for (const group of tabGroups) section.append(createSnapRow(group));
  container.replaceChildren(section);
}

export function showMain(rawTab, rawCollections) {
  const tab = {
    title: typeof rawTab?.title === "string" ? rawTab.title : "Untitled",
    url: typeof rawTab?.url === "string" ? rawTab.url : "",
  };
  const collections = normalizeCollections(rawCollections);
  const isDev = API_BASE === DEV_URL;

  const environment = element("div", { className: "environment-indicator" });
  environment.append(element("span", {
    className: `env-badge ${isDev ? "dev" : "prod"}`,
    text: isDev ? "DEV" : "PROD",
  }));

  const currentTab = element("div", { className: "current-tab" });
  const titleInput = element("input", { id: "title-input", className: "title-input" });
  titleInput.type = "text";
  titleInput.value = tab.title;
  currentTab.append(
    element("div", { className: "label", text: "Current Tab" }),
    titleInput,
    element("div", { className: "url", text: tab.url }),
  );

  const form = element("div", { className: "form" });
  const collectionSelect = element("select", { id: "collection-select" });
  for (const collection of collections) {
    const option = element("option", {
      text: `${collection.name} (${collection.bookmarkCount})`,
    });
    option.value = String(collection.id);
    collectionSelect.append(option);
  }
  const saveButton = element("button", {
    id: "save-btn",
    className: "btn-primary",
    text: "Save Bookmark",
    type: "button",
  });
  form.append(element("label", { text: "Collection" }), collectionSelect, saveButton);

  const status = element("div", { id: "status" });
  const tabGroupsSection = element("div", { id: "tab-groups-section" });
  const children = [environment, currentTab, form, status];

  if (collections.length > 0) {
    const collectionSection = element("div", { className: "section" });
    collectionSection.append(element("div", { className: "section-label", text: "Recall Groups" }));
    for (const collection of collections) collectionSection.append(createCollectionRow(collection));
    children.push(collectionSection);
  }
  children.push(tabGroupsSection);
  getApp().replaceChildren(...children);

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    try {
      const response = await apiFetch("/api/bookmarks", {
        method: "POST",
        body: JSON.stringify({
          title: titleInput.value.trim() || tab.url,
          url: tab.url,
          collectionId: collectionSelect.value ? Number.parseInt(collectionSelect.value, 10) : null,
        }),
      });
      if (response.ok) {
        renderStatus("✓ Saved", "success");
        saveButton.textContent = "Saved!";
        setTimeout(() => {
          saveButton.textContent = "Save Bookmark";
          saveButton.disabled = false;
        }, 2000);
      } else if (response.status === 409) {
        renderStatus("Already saved in this collection", "error");
        saveButton.disabled = false;
        saveButton.textContent = "Save Bookmark";
      } else {
        throw new Error("Bookmark creation failed");
      }
    } catch {
      renderStatus("Failed to save", "error");
      saveButton.disabled = false;
      saveButton.textContent = "Save Bookmark";
    }
  });

  chrome.runtime.sendMessage({ type: "GET_TAB_GROUPS" }, (tabGroups) => {
    renderTabGroups(tabGroupsSection, tabGroups);
  });
}

export function chromeColorToHex(color) {
  const colors = {
    grey: "#71717a",
    blue: "#2563eb",
    red: "#dc2626",
    yellow: "#ca8a04",
    green: "#16a34a",
    pink: "#db2777",
    purple: "#9333ea",
    cyan: "#0891b2",
    orange: "#ea580c",
  };
  return colors[color] || "#a1a1aa";
}

if (typeof chrome !== "undefined") {
  void init();
}
