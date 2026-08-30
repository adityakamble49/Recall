// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { init, showError, showMain, showSettings } from "@/extension/popup.js";
import { authorizeExtension, authorizedFetch } from "@/extension/auth.js";

const ATTACK = `"><img src=x onerror="alert(1)"><svg onload="alert(2)">`;
const ACCESS_TOKEN = `recall_ext_${"a".repeat(32)}.${"b".repeat(43)}`;
const CREDENTIAL = { accessToken: ACCESS_TOKEN, expiresAt: "2999-01-01T00:00:00.000Z" };

type ChromeMock = {
  identity: { getRedirectURL: ReturnType<typeof vi.fn>; launchWebAuthFlow: ReturnType<typeof vi.fn> };
  permissions: { request: ReturnType<typeof vi.fn> };
  runtime: { sendMessage: ReturnType<typeof vi.fn> };
  storage: { local: {
    get: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    setAccessLevel: ReturnType<typeof vi.fn>;
  } };
  tabs: { create: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
};

function resetDocument() {
  const app = document.createElement("div");
  app.id = "app";
  document.body.replaceChildren(app);
}

function installChromeMock(tabGroups: unknown[] = []) {
  const chromeMock: ChromeMock = {
    identity: {
      getRedirectURL: vi.fn().mockReturnValue("https://mifdhnokgeipckgedpbnccdlllpdpcel.chromiumapp.org/recall-auth"),
      launchWebAuthFlow: vi.fn(),
    },
    permissions: { request: vi.fn().mockResolvedValue(true) },
    runtime: {
      sendMessage: vi.fn((message: { type?: string }, callback?: (value: unknown[]) => void) => {
        if (message.type === "GET_TAB_GROUPS") callback?.(tabGroups);
      }),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ extensionCredential: CREDENTIAL }),
        remove: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
        setAccessLevel: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      create: vi.fn(),
      query: vi.fn().mockResolvedValue([]),
    },
  };

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: chromeMock,
  });
  return chromeMock;
}

async function settleAsyncHandlers() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("extension popup DOM injection defenses", () => {
  beforeEach(() => {
    resetDocument();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "chrome");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does not contain HTML parsing or code execution sinks", () => {
    const source = ["extension/popup.js", "extension/auth.js"]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\b/);
  });

  it("does not request cookies or forward the web session token", () => {
    const manifest = readFileSync(join(process.cwd(), "extension/manifest.json"), "utf8");
    const source = ["extension/popup.js", "extension/auth.js"]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(JSON.parse(manifest).permissions).toContain("identity");
    expect(JSON.parse(manifest).permissions).not.toContain("cookies");
    expect(source).not.toMatch(/chrome\.cookies|X-Session-Token|x-session-token|authjs\.session-token/);
  });

  it("exchanges a state-bound PKCE code and stores only the extension credential", async () => {
    const chromeMock = installChromeMock();
    chromeMock.identity.launchWebAuthFlow.mockImplementation(async ({ url }: { url: string }) => {
      const authorizeUrl = new URL(url);
      const callback = new URL(chromeMock.identity.getRedirectURL());
      callback.searchParams.set("code", "c".repeat(43));
      callback.searchParams.set("state", authorizeUrl.searchParams.get("state") ?? "");
      return callback.toString();
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: ACCESS_TOKEN, expires_at: CREDENTIAL.expiresAt }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await authorizeExtension("https://recall.ltd");

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ extensionCredential: CREDENTIAL });
    expect(fetchMock).toHaveBeenCalledWith("https://recall.ltd/api/extension/token", expect.objectContaining({
      method: "POST",
    }));
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.code).toBe("c".repeat(43));
    expect(requestBody.code_verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(requestBody.redirect_uri).toContain("mifdhnokgeipckgedpbnccdlllpdpcel.chromiumapp.org");
  });

  it("rejects a callback whose authorization state does not match", async () => {
    const chromeMock = installChromeMock();
    chromeMock.identity.launchWebAuthFlow.mockResolvedValue(
      "https://mifdhnokgeipckgedpbnccdlllpdpcel.chromiumapp.org/recall-auth?code=value&state=wrong",
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(authorizeExtension("https://recall.ltd")).rejects.toThrow("state did not match");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears the scoped credential when the API rejects it", async () => {
    const chromeMock = installChromeMock();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 401 }));

    await authorizedFetch("https://recall.ltd", "/api/collections");

    expect(chromeMock.storage.local.remove).toHaveBeenCalledWith(["extensionCredential"]);
  });

  it("renders hostile tab, collection, and group values as inert text", () => {
    installChromeMock([{
      id: 4,
      title: ATTACK,
      color: `url("javascript:alert(3)")`,
      tabs: [{ title: ATTACK, url: `https://example.com/?payload=${encodeURIComponent(ATTACK)}` }],
    }]);

    showMain(
      { title: ATTACK, url: `https://example.com/?payload=${encodeURIComponent(ATTACK)}` },
      [{ id: 7, name: ATTACK, bookmarkCount: 1 }],
    );

    expect((document.querySelector("#title-input") as HTMLInputElement).value).toBe(ATTACK);
    expect(document.querySelector("option")?.textContent).toBe(`${ATTACK} (1)`);
    expect(document.querySelector("#tab-groups-section")?.textContent).toContain(ATTACK);
    expect(document.querySelectorAll("img, svg, script, [onerror], [onload]")).toHaveLength(0);
    expect((document.querySelector(".group-color") as HTMLElement).style.backgroundColor).toBe("rgb(161, 161, 170)");
  });

  it("renders hostile error messages as inert text", () => {
    installChromeMock();

    showError(ATTACK);

    expect(document.querySelector(".status")?.textContent).toBe(ATTACK);
    expect(document.querySelectorAll("img, svg, script, [onerror], [onload]")).toHaveLength(0);
  });

  it("keeps a hostile configured API endpoint in the input value", async () => {
    const chromeMock = installChromeMock();
    chromeMock.storage.local.get.mockResolvedValue({ apiBase: ATTACK });

    await init();
    await showSettings();

    expect((document.querySelector("#api-url-input") as HTMLInputElement).value).toBe(ATTACK);
    expect(document.querySelectorAll("img, svg, script, [onerror], [onload]")).toHaveLength(0);
  });

  it("recalls a collection using closure-bound data", async () => {
    const chromeMock = installChromeMock();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ url: "https://safe.example" }]),
    }));
    showMain(
      { title: "Current", url: "https://current.example" },
      [{ id: 9, name: ATTACK, bookmarkCount: 1 }],
    );

    (document.querySelector(".recall-btn") as HTMLButtonElement).click();
    await settleAsyncHandlers();

    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_TAB_GROUP",
      urls: ["https://safe.example"],
      name: ATTACK,
    });
    expect(document.querySelector(".recall-btn")?.hasAttribute("data-collection")).toBe(false);
  });

  it("snaps a group using closure-bound data", async () => {
    installChromeMock([{
      id: 5,
      title: ATTACK,
      color: "blue",
      tabs: [{ title: ATTACK, url: "https://safe.example" }],
    }]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 12 }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 13 }) });
    vi.stubGlobal("fetch", fetchMock);
    showMain({ title: "Current", url: "https://current.example" }, []);

    (document.querySelector(".save-group-btn") as HTMLButtonElement).click();
    await settleAsyncHandlers();

    const [, collectionOptions] = fetchMock.mock.calls[0];
    expect(JSON.parse(collectionOptions.body)).toEqual({ name: ATTACK });
    expect(document.querySelector(".save-group-btn")?.hasAttribute("data-group")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
