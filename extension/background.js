import { authorizeExtension } from "./auth.js";
import { isAllowedApiBase } from "./config.js";

// Background service worker for authentication and tab group operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTHORIZE_EXTENSION") {
    authorizeFromBackground(message.apiBase).then(sendResponse);
    return true; // keep the worker alive while the auth window is open
  }
  if (message.type === "OPEN_TAB_GROUP") {
    openAsTabGroup(message.urls, message.name, message.color);
    sendResponse({ ok: true });
  }
  if (message.type === "GET_TAB_GROUPS") {
    getTabGroups().then(sendResponse);
    return true; // keep channel open for async response
  }
});

async function authorizeFromBackground(apiBase) {
  if (!isAllowedApiBase(apiBase)) {
    return { ok: false, error: "Invalid API endpoint" };
  }
  try {
    await authorizeExtension(apiBase);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Authorization failed",
    };
  }
}

async function openAsTabGroup(urls, name, color) {
  const tabIds = [];
  for (const url of urls) {
    const tab = await chrome.tabs.create({ url, active: false });
    tabIds.push(tab.id);
  }
  if (tabIds.length > 0) {
    const groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, {
      title: name,
      color: color || "blue",
      collapsed: false,
    });
    chrome.tabs.update(tabIds[0], { active: true });
  }
}

async function getTabGroups() {
  const groups = await chrome.tabGroups.query({});
  const tabs = await chrome.tabs.query({ currentWindow: true });

  return groups.map((g) => ({
    id: g.id,
    title: g.title || "Untitled Group",
    color: g.color,
    tabs: tabs
      .filter((t) => t.groupId === g.id)
      .map((t) => ({ title: t.title, url: t.url })),
  }));
}
