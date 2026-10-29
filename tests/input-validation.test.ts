import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateBookmarkFields, validateBookmarkTitle, validateCollectionFields } from "@/lib/validation";

// Each db call (select/insert/update/delete) consumes the next queued result and
// records the arguments passed to .values() and .set().
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getApiPrincipal: vi.fn(),
  getApiUser: vi.fn(),
  getOwnedActiveCollectionId: vi.fn(),
  results: [] as unknown[],
  ops: [] as { op: string; values?: unknown; set?: unknown }[],
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/fetch-title", () => ({ fetchPageTitle: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/api-auth", () => ({
  getApiPrincipal: mocks.getApiPrincipal,
  getApiUser: mocks.getApiUser,
  hasTrustedSessionMutationOrigin: () => true,
}));
vi.mock("@/lib/collection-access", () => ({
  getOwnedActiveCollectionId: mocks.getOwnedActiveCollectionId,
  isValidCollectionId: (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0,
}));
vi.mock("@/lib/db", () => {
  function query(op: string) {
    const record: { op: string; values?: unknown; set?: unknown } = { op };
    mocks.ops.push(record);
    const result = mocks.results.length > 0 ? mocks.results.shift() : [];
    const builder: Record<string, unknown> = {};
    for (const method of ["from", "where", "limit", "orderBy", "groupBy", "returning"]) {
      builder[method] = () => builder;
    }
    builder.values = (values: unknown) => { record.values = values; return builder; };
    builder.set = (set: unknown) => { record.set = set; return builder; };
    builder.then = (resolve: (value: unknown) => void) => resolve(result);
    return builder;
  }
  return {
    db: {
      select: () => query("select"),
      insert: () => query("insert"),
      update: () => query("update"),
      delete: () => query("delete"),
    },
  };
});

import { createCollection, renameBookmark, updateCollection } from "@/app/actions";
import { GET as getBookmarks, POST as postBookmark } from "@/app/api/bookmarks/route";
import { POST as postCollection } from "@/app/api/collections/route";

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function writes() {
  return mocks.ops.filter((o) => o.op !== "select");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.results.length = 0;
  mocks.ops.length = 0;
  mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
  mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "extension" });
  mocks.getApiUser.mockResolvedValue("user-a");
  mocks.getOwnedActiveCollectionId.mockImplementation(async (_userId, id) => id);
});

describe("validation helpers", () => {
  it("rejects non-string bookmark fields", () => {
    expect(validateBookmarkFields({ title: { a: 1 }, url: "https://example.com" }).valid).toBe(false);
    expect(validateBookmarkFields({ title: "Example", url: ["https://example.com"] }).valid).toBe(false);
    expect(validateBookmarkFields({ title: "Example", url: "https://example.com", description: 5 }).valid).toBe(false);
    expect(validateBookmarkFields({ title: "Example", url: "https://example.com", description: null }).valid).toBe(true);
  });

  it("trims bookmark titles and rejects blank or overlong ones", () => {
    expect(validateBookmarkTitle("  Example  ")).toEqual({ valid: true, value: "Example" });
    expect(validateBookmarkTitle("   ").valid).toBe(false);
    expect(validateBookmarkTitle(42).valid).toBe(false);
    expect(validateBookmarkTitle("x".repeat(501)).valid).toBe(false);
  });

  it("keeps only known collection fields and checks their format", () => {
    expect(validateCollectionFields(
      { name: " Reading ", icon: "book-open", color: "#4343d5", userId: "user-b", isDefault: true },
      { requireName: true },
    )).toEqual({ valid: true, value: { name: "Reading", icon: "book-open", color: "#4343d5" } });

    for (const bad of [
      {}, { name: "" }, { name: "  " }, { name: 7 }, { name: "x".repeat(101) },
      { name: "A", color: "red" }, { name: "A", color: "#12345" }, { name: "A", icon: "<svg>" },
      { name: "A", description: "x".repeat(501) },
    ]) {
      expect(validateCollectionFields(bad, { requireName: true }).valid).toBe(false);
    }
    expect(validateCollectionFields({}, { requireName: false })).toEqual({ valid: true, value: {} });
  });
});

describe("collection server actions", () => {
  it("createCollection ignores client-supplied ownership and default flags", async () => {
    const result = await createCollection({ name: "Reading", userId: "user-b", isDefault: true } as never);

    expect(result).toEqual({});
    expect(writes()).toEqual([{ op: "insert", values: { name: "Reading", userId: "user-a" } }]);
  });

  it("createCollection rejects blank and overlong names without writing", async () => {
    expect((await createCollection({ name: "  " })).error).toBeDefined();
    expect((await createCollection({ name: "x".repeat(101) })).error).toBeDefined();
    expect(mocks.ops).toEqual([]);
  });

  it("updateCollection rejects a name used by another active collection", async () => {
    mocks.results.push([{ id: 9 }]);

    const result = await updateCollection(3, { name: "Reading" });

    expect(result).toEqual({ error: "Collection already exists" });
    expect(writes()).toEqual([]);
  });

  it("updateCollection writes only name and description", async () => {
    mocks.results.push([]);

    const result = await updateCollection(3, { name: " Reading ", userId: "user-b", isDeleted: false } as never);

    expect(result).toEqual({});
    expect(writes()).toEqual([{ op: "update", set: { name: "Reading" } }]);
  });

  it("updateCollection rejects invalid ids and names without writing", async () => {
    expect((await updateCollection(0, { name: "Reading" })).error).toBeDefined();
    expect((await updateCollection(3, { name: "" })).error).toBeDefined();
    expect(mocks.ops).toEqual([]);
  });

  it("renameBookmark trims the title and rejects blank titles", async () => {
    expect((await renameBookmark(4, "   ")).error).toBeDefined();
    expect(mocks.ops).toEqual([]);

    expect(await renameBookmark(4, "  New title ")).toEqual({});
    expect(writes()).toEqual([{ op: "update", set: { title: "New title" } }]);
  });
});

describe("POST /api/collections validation", () => {
  it("rejects invalid fields with 400 before database access", async () => {
    for (const body of [{ name: "" }, { name: 5 }, { name: "x".repeat(101) }, { name: "A", color: "javascript:" }]) {
      const response = await postCollection(jsonRequest("https://recall.ltd/api/collections", body));
      expect(response.status).toBe(400);
    }
    expect(mocks.ops).toEqual([]);
  });

  it("rejects malformed JSON with 400", async () => {
    const response = await postCollection(new NextRequest("https://recall.ltd/api/collections", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    }));
    expect(response.status).toBe(400);
  });

  it("stores the trimmed name and drops unknown fields", async () => {
    mocks.results.push([], [{ id: 7 }]);

    const response = await postCollection(jsonRequest("https://recall.ltd/api/collections", {
      name: " Tab group ", userId: "user-b", isDefault: true,
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 7 });
    expect(writes()).toEqual([{ op: "insert", values: { name: "Tab group", userId: "user-a" } }]);
  });
});

describe("/api/bookmarks", () => {
  it("POST persists the description", async () => {
    mocks.results.push([]);

    const response = await postBookmark(jsonRequest("https://recall.ltd/api/bookmarks", {
      title: "Example", url: "https://example.com", collectionId: 7, description: "Notes",
    }));

    expect(response.status).toBe(200);
    expect(writes()).toEqual([{ op: "insert", values: expect.objectContaining({
      userId: "user-a", collectionId: 7, description: "Notes",
    }) }]);
  });

  it("POST rejects non-string fields with 400", async () => {
    const response = await postBookmark(jsonRequest("https://recall.ltd/api/bookmarks", {
      title: ["Example"], url: "https://example.com",
    }));

    expect(response.status).toBe(400);
    expect(writes()).toEqual([]);
  });

  it.each(["abc", "7abc", "0", "-1", "1.5", "", "99999999999999999999"])(
    "GET rejects collectionId=%j with 400",
    async (value) => {
      const response = await getBookmarks(new NextRequest(`https://recall.ltd/api/bookmarks?collectionId=${value}`));
      expect(response.status).toBe(400);
      expect(mocks.getOwnedActiveCollectionId).not.toHaveBeenCalled();
    },
  );

  it("GET returns 404 for a foreign or trashed collection", async () => {
    mocks.getOwnedActiveCollectionId.mockResolvedValue(null);

    const response = await getBookmarks(new NextRequest("https://recall.ltd/api/bookmarks?collectionId=8"));

    expect(response.status).toBe(404);
    expect(mocks.ops).toEqual([]);
  });

  it("GET returns bookmarks for an owned active collection", async () => {
    mocks.results.push([{ id: 1, url: "https://example.com" }]);

    const response = await getBookmarks(new NextRequest("https://recall.ltd/api/bookmarks?collectionId=7"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 1, url: "https://example.com" }]);
    expect(mocks.getOwnedActiveCollectionId).toHaveBeenCalledWith("user-a", 7);
  });

  it("GET without collectionId looks up trashed collections before listing", async () => {
    mocks.results.push([{ id: 5 }], [{ id: 1 }]);

    const response = await getBookmarks(new NextRequest("https://recall.ltd/api/bookmarks"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 1 }]);
    expect(mocks.ops.map((o) => o.op)).toEqual(["select", "select"]);
  });
});
