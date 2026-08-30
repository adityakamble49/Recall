import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getApiPrincipal: vi.fn(),
  getApiUser: vi.fn(),
  hasTrustedSessionMutationOrigin: vi.fn(),
  getOwnedActiveCollectionId: vi.fn(),
  isValidCollectionId: vi.fn(),
  fetchPageTitle: vi.fn(),
  selectLimit: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/api-auth", () => ({
  getApiPrincipal: mocks.getApiPrincipal,
  getApiUser: mocks.getApiUser,
  hasTrustedSessionMutationOrigin: mocks.hasTrustedSessionMutationOrigin,
}));
vi.mock("@/lib/collection-access", () => ({
  getOwnedActiveCollectionId: mocks.getOwnedActiveCollectionId,
  isValidCollectionId: mocks.isValidCollectionId,
}));
vi.mock("@/lib/fetch-title", () => ({ fetchPageTitle: mocks.fetchPageTitle }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mocks.selectLimit }) }) }),
    insert: () => ({ values: mocks.insertValues }),
  },
}));

import { POST } from "@/app/api/bookmarks/route";
import { createBookmark } from "@/app/actions";

function request(body: unknown, origin?: string) {
  return new NextRequest("https://recall.ltd/api/bookmarks", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/bookmarks collection authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "extension" });
    mocks.getApiUser.mockResolvedValue("user-a");
    mocks.hasTrustedSessionMutationOrigin.mockReturnValue(true);
    mocks.selectLimit.mockResolvedValue([]);
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.fetchPageTitle.mockResolvedValue(null);
    mocks.isValidCollectionId.mockImplementation((value) => typeof value === "number" && Number.isSafeInteger(value) && value > 0);
  });

  it("rejects a foreign collection without fetching a title or inserting a bookmark", async () => {
    mocks.getOwnedActiveCollectionId.mockResolvedValue(null);

    const response = await POST(request({ title: "Example", url: "https://example.com", collectionId: 42 }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Collection not found" });
    expect(mocks.selectLimit).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
    expect(mocks.fetchPageTitle).not.toHaveBeenCalled();
  });

  it("rejects a deleted collection through the same non-enumerating response", async () => {
    mocks.getOwnedActiveCollectionId.mockResolvedValue(null);

    const response = await POST(request({ title: "Example", url: "https://example.com", collectionId: 8 }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Collection not found" });
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("rejects malformed collection IDs without checking ownership", async () => {
    mocks.isValidCollectionId.mockReturnValue(false);

    const response = await POST(request({ title: "Example", url: "https://example.com", collectionId: "42" }));

    expect(response.status).toBe(400);
    expect(mocks.getOwnedActiveCollectionId).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("saves into a verified active collection", async () => {
    mocks.getOwnedActiveCollectionId.mockResolvedValue(7);

    const response = await POST(request({ title: "Example", url: "https://example.com", collectionId: 7 }));

    expect(response.status).toBe(200);
    expect(mocks.getApiPrincipal).toHaveBeenCalledWith("bookmarks:write");
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a", collectionId: 7 }));
  });

  it("uses the caller's default collection when collectionId is omitted", async () => {
    mocks.selectLimit.mockResolvedValueOnce([{ id: 12 }]).mockResolvedValueOnce([]);

    const response = await POST(request({ title: "Example", url: "https://example.com" }));

    expect(response.status).toBe(200);
    expect(mocks.getOwnedActiveCollectionId).not.toHaveBeenCalled();
    expect(mocks.insertValues).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a", collectionId: 12 }));
  });

  it("rejects an untrusted session origin before parsing or writing data", async () => {
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "session" });
    mocks.hasTrustedSessionMutationOrigin.mockReturnValue(false);

    const response = await POST(request({ title: "Example", url: "https://example.com" }, "https://evil.recall.ltd"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Untrusted request origin" });
    expect(mocks.selectLimit).not.toHaveBeenCalled();
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("accepts a trusted session origin", async () => {
    mocks.getApiPrincipal.mockResolvedValue({ userId: "user-a", authType: "session" });
    mocks.selectLimit.mockResolvedValueOnce([{ id: 12 }]).mockResolvedValueOnce([]);

    const response = await POST(request(
      { title: "Example", url: "https://example.com" },
      "https://recall.ltd",
    ));

    expect(response.status).toBe(200);
    expect(mocks.hasTrustedSessionMutationOrigin).toHaveBeenCalledOnce();
  });

  it("rejects a foreign collection through the server action before inserting", async () => {
    mocks.getOwnedActiveCollectionId.mockResolvedValue(null);

    const result = await createBookmark({ title: "Example", url: "https://example.com", collectionId: 42 });

    expect(result).toEqual({ error: "Collection not found" });
    expect(mocks.insertValues).not.toHaveBeenCalled();
  });
});
