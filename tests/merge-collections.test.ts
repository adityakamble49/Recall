import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOwnedActiveCollectionId: vi.fn(),
  selectWhere: vi.fn(),
  updateWhere: vi.fn(),
  deleteWhere: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/fetch-title", () => ({ fetchPageTitle: vi.fn() }));
vi.mock("@/lib/collection-access", () => ({
  getOwnedActiveCollectionId: mocks.getOwnedActiveCollectionId,
  isValidCollectionId: (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0,
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mocks.selectWhere }) }),
    update: () => ({ set: () => ({ where: mocks.updateWhere }) }),
    delete: () => ({ where: mocks.deleteWhere }),
  },
}));

import { mergeCollections } from "@/app/actions";

function expectNoWrites() {
  expect(mocks.updateWhere).not.toHaveBeenCalled();
  expect(mocks.deleteWhere).not.toHaveBeenCalled();
}

describe("mergeCollections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-a" } });
    mocks.getOwnedActiveCollectionId.mockImplementation(async (_userId, id) => id);
    mocks.selectWhere.mockResolvedValue([{ id: 2, isDefault: false }, { id: 3, isDefault: false }]);
    mocks.updateWhere.mockResolvedValue(undefined);
    mocks.deleteWhere.mockResolvedValue(undefined);
  });

  it("moves bookmarks then deletes owned, active, non-default sources", async () => {
    const result = await mergeCollections([2, 3], 1);

    expect(result).toEqual({});
    expect(mocks.getOwnedActiveCollectionId).toHaveBeenCalledWith("user-a", 1);
    expect(mocks.updateWhere).toHaveBeenCalledOnce();
    expect(mocks.deleteWhere).toHaveBeenCalledOnce();
    expect(mocks.updateWhere.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteWhere.mock.invocationCallOrder[0]);
  });

  it("rejects a target that is also a source", async () => {
    const result = await mergeCollections([1, 2], 1);

    expect(result.error).toBeDefined();
    expect(mocks.selectWhere).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("rejects merging away the default collection", async () => {
    mocks.selectWhere.mockResolvedValue([{ id: 2, isDefault: true }, { id: 3, isDefault: false }]);

    const result = await mergeCollections([2, 3], 1);

    expect(result.error).toBeDefined();
    expectNoWrites();
  });

  it("rejects sources that are foreign, deleted or missing", async () => {
    mocks.selectWhere.mockResolvedValue([{ id: 2, isDefault: false }]);

    const result = await mergeCollections([2, 3], 1);

    expect(result).toEqual({ error: "Collection not found" });
    expectNoWrites();
  });

  it("rejects a target the user does not own or that is in the trash", async () => {
    mocks.getOwnedActiveCollectionId.mockResolvedValue(null);

    const result = await mergeCollections([2, 3], 1);

    expect(result).toEqual({ error: "Collection not found" });
    expectNoWrites();
  });

  it("rejects empty and malformed input before querying", async () => {
    for (const [sources, target] of [[[], 1], [["2"], 1], [[2], 0], [[2.5], 1]] as [unknown[], unknown][]) {
      const result = await mergeCollections(sources as number[], target as number);
      expect(result.error).toBeDefined();
    }
    expect(mocks.getOwnedActiveCollectionId).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("treats duplicate source ids as one source", async () => {
    mocks.selectWhere.mockResolvedValue([{ id: 2, isDefault: false }]);

    const result = await mergeCollections([2, 2], 1);

    expect(result).toEqual({});
  });

  it("requires a signed-in user", async () => {
    mocks.auth.mockResolvedValue(null);

    await expect(mergeCollections([2], 1)).rejects.toThrow("Unauthorized");
    expectNoWrites();
  });
});
