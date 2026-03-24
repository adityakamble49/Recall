// Background service worker for tab group operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_TAB_GROUP") {
    openAsTabGroup(message.urls, message.name, message.color);
    sendResponse({ ok: true });
  }
  if (message.type === "GET_TAB_GROUPS") {
    getTabGroups().then(sendResponse);
    return true; // keep channel open for async response
  }
});

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
