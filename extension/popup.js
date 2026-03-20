// Configure your deployed app URL here
const API_BASE = "https://bookmarks-tracker.vercel.app";

const app = document.getElementById("app");

async function init() {
  // Get current tab info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Fetch collections from API
  let collections = [];
  try {
    const res = await fetch(`${API_BASE}/api/collections`, { credentials: "include" });
    if (res.status === 401) {
      app.innerHTML = `
        <div class="signin-prompt">
          <p>Sign in to Recall to save bookmarks.</p>
          <a href="${API_BASE}" target="_blank">Open Recall →</a>
        </div>`;
      return;
    }
    collections = await res.json();
  } catch {
    app.innerHTML = `<div class="status error">Could not connect to Recall.</div>`;
    return;
  }

  // Render UI
  const collectionsOptions = collections.map(
    (c) => `<option value="${c.id}">${c.name}</option>`
  ).join("");

  const collectionsList = collections.map(
    (c) => `<div class="col-item" data-id="${c.id}">
      <span class="name">${c.name} (${c.bookmarkCount})</span>
      <button class="open-btn" data-urls='${JSON.stringify([])}' data-name="${c.name}">Open Group</button>
    </div>`
  ).join("");

  app.innerHTML = `
    <div class="current-tab">
      <div class="label">Current Tab</div>
      <div class="title">${tab.title || "Untitled"}</div>
      <div class="url">${tab.url || ""}</div>
    </div>
    <div class="form">
      <label>Save to Collection</label>
      <select id="collection-select">
        <option value="">General</option>
        ${collectionsOptions}
      </select>
      <button class="save-btn" id="save-btn">Save Bookmark</button>
    </div>
    <div id="status"></div>
    ${collections.length > 0 ? `
      <div class="collections">
        <div class="section-label">Open as Tab Group</div>
        ${collectionsList}
      </div>` : ""}`;

  // Save bookmark handler
  document.getElementById("save-btn").addEventListener("click", async () => {
    const btn = document.getElementById("save-btn");
    const select = document.getElementById("collection-select");
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const res = await fetch(`${API_BASE}/api/bookmarks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tab.title || tab.url,
          url: tab.url,
          collectionId: select.value ? parseInt(select.value) : null,
        }),
      });
      if (res.ok) {
        document.getElementById("status").innerHTML = `<div class="status success">✓ Saved!</div>`;
        btn.textContent = "Saved!";
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
  document.querySelectorAll(".col-item").forEach((item) => {
    const openBtn = item.querySelector(".open-btn");
    openBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const colId = item.dataset.id;
      const name = openBtn.dataset.name;
      // Fetch bookmarks for this collection
      try {
        const res = await fetch(`${API_BASE}/api/collections`, { credentials: "include" });
        // For now, open the collection page — full tab group via background worker
        const colRes = await fetch(`${API_BASE}/api/bookmarks?collectionId=${colId}`, { credentials: "include" });
        if (colRes.ok) {
          const bookmarks = await colRes.json();
          const urls = bookmarks.map((b) => b.url);
          chrome.runtime.sendMessage({ type: "OPEN_TAB_GROUP", urls, name });
        }
      } catch {
        // Fallback: open collection page
        chrome.tabs.create({ url: `${API_BASE}/collections/${colId}` });
      }
    });
  });
}

init();
