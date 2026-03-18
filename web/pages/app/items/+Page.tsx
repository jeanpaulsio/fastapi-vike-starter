import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listItems, createItem, deleteItem } from "@/services/items";
import type { Item } from "@/lib/types";

export default function ItemsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
  });

  const createMutation = useMutation({
    mutationFn: () => createItem(title, description || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      setTitle("");
      setDescription("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="mb-1 text-xl font-extrabold text-foreground">Items</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Example CRUD resource — demonstrates the full stack pattern.
      </p>

      {/* Create form */}
      <form onSubmit={handleSubmit} className="mb-5 rounded-[10px] border border-border bg-card p-4">
        <div className="mb-3">
          <label htmlFor="title" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New item..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="description" className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Description (optional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description..."
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending || !title.trim()}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "Create Item"}
        </button>
      </form>

      {/* Items list */}
      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground">Loading...</div>
      ) : data?.items.length === 0 ? (
        <div className="rounded-[10px] border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No items yet. Create one above to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {data?.items.map((item: Item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-[10px] border border-border bg-card p-4"
            >
              <div>
                <div className="text-sm font-semibold text-foreground">{item.title}</div>
                {item.description && (
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.description}</div>
                )}
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {item.status} &middot; {new Date(item.created_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(item.id)}
                disabled={deleteMutation.isPending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Delete
              </button>
            </div>
          ))}
          {data?.has_more && (
            <div className="pt-2 text-center text-xs text-muted-foreground">
              Showing {data.items.length} of {data.total} items
            </div>
          )}
        </div>
      )}
    </div>
  );
}
