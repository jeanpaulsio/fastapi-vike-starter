import type { Item, PaginatedResponse } from "@/lib/types";
import apiClient from "./client";

export async function listItems(page = 1, limit = 20): Promise<PaginatedResponse<Item>> {
  const { data } = await apiClient.get<PaginatedResponse<Item>>("/items", {
    params: { page, limit },
  });
  return data;
}

export async function getItem(id: string): Promise<Item> {
  const { data } = await apiClient.get<Item>(`/items/${id}`);
  return data;
}

export async function createItem(title: string, description?: string): Promise<Item> {
  const { data } = await apiClient.post<Item>("/items", { title, description });
  return data;
}

export async function updateItem(
  id: string,
  updates: { title?: string; description?: string; status?: string },
): Promise<Item> {
  const { data } = await apiClient.patch<Item>(`/items/${id}`, updates);
  return data;
}

export async function deleteItem(id: string): Promise<void> {
  await apiClient.delete(`/items/${id}`);
}
