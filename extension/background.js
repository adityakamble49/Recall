// Background service worker for tab group creation
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_TAB_GROUP") {
    openAsTabGroup(message.urls, message.name, message.color);
    sendResponse({ ok: true });
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
    // Activate the first tab
    chrome.tabs.update(tabIds[0], { active: true });
  }
}
