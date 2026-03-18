import { describe, it, expect, vi, beforeEach } from "vitest";
import { listItems, getItem, createItem, updateItem, deleteItem } from "@/services/items";
import apiClient from "@/services/client";

vi.mock("@/services/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("items service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listItems calls GET /items with pagination", async () => {
    const mockData = { items: [], total: 0, page: 1, limit: 20, has_more: false };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });

    const result = await listItems(2, 10);
    expect(apiClient.get).toHaveBeenCalledWith("/items", { params: { page: 2, limit: 10 } });
    expect(result).toEqual(mockData);
  });

  it("getItem calls GET /items/:id", async () => {
    const mockItem = { id: "abc", title: "Test" };
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockItem });

    const result = await getItem("abc");
    expect(apiClient.get).toHaveBeenCalledWith("/items/abc");
    expect(result).toEqual(mockItem);
  });

  it("createItem calls POST /items", async () => {
    const mockItem = { id: "new", title: "New" };
    vi.mocked(apiClient.post).mockResolvedValue({ data: mockItem });

    const result = await createItem("New", "Desc");
    expect(apiClient.post).toHaveBeenCalledWith("/items", { title: "New", description: "Desc" });
    expect(result).toEqual(mockItem);
  });

  it("updateItem calls PATCH /items/:id", async () => {
    const mockItem = { id: "abc", title: "Updated" };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: mockItem });

    const result = await updateItem("abc", { title: "Updated" });
    expect(apiClient.patch).toHaveBeenCalledWith("/items/abc", { title: "Updated" });
    expect(result).toEqual(mockItem);
  });

  it("deleteItem calls DELETE /items/:id", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({});

    await deleteItem("abc");
    expect(apiClient.delete).toHaveBeenCalledWith("/items/abc");
  });
});
