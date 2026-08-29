// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { init, showError, showMain, showSettings } from "@/extension/popup.js";

const ATTACK = `"><img src=x onerror="alert(1)"><svg onload="alert(2)">`;

type ChromeMock = {
  cookies: { get: ReturnType<typeof vi.fn> };
  runtime: { sendMessage: ReturnType<typeof vi.fn> };
  storage: { local: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } };
  tabs: { create: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
};

function resetDocument() {
  const app = document.createElement("div");
  app.id = "app";
  document.body.replaceChildren(app);
}

function installChromeMock(tabGroups: unknown[] = []) {
  const chromeMock: ChromeMock = {
    cookies: { get: vi.fn().mockResolvedValue({ value: "session" }) },
    runtime: {
      sendMessage: vi.fn((message: { type?: string }, callback?: (value: unknown[]) => void) => {
        if (message.type === "GET_TAB_GROUPS") callback?.(tabGroups);
      }),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
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
    const source = readFileSync(join(process.cwd(), "extension/popup.js"), "utf8");

    expect(source).not.toMatch(/\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML|document\.write|\beval\s*\(|new\s+Function\b/);
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
    chromeMock.cookies.get.mockResolvedValue(null);

    await init();
    showSettings();

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
