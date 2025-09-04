// src/app/admin/(protected)/products/new/ui/NewProductForm.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string };

export default function NewProductForm({ categories }: { categories: Category[] }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [priceGhs, setpriceGhs] = useState<string>("");
  const [stock, setStock] = useState<string>("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [files, setFiles] = useState<FileList | null>(null);

  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const toggleCat = (id: string) =>
    setSelectedCats(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  // previews
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    if (!files?.length) { setPreviews([]); return; }
    const urls = Array.from(files).map(f => URL.createObjectURL(f));
    setPreviews(urls);
    return () => { urls.forEach(u => URL.revokeObjectURL(u)); };
  }, [files]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!title.trim()) return setErr("Title is required.");
    const price_cents = Math.round((Number(priceGhs) || 0) * 100);
    if (price_cents < 0) return setErr("Price must be >= 0.");
    const stockInt = Number(stock);
    if (!Number.isFinite(stockInt) || stockInt < 0) return setErr("Stock must be >= 0.");

    setSaving(true);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("description", description);
      form.append("price_cents", String(price_cents));
      form.append("stock", String(stockInt));
      form.append("status", status);
      form.append("category_ids", JSON.stringify(selectedCats));
      if (files?.length) Array.from(files).forEach(f => form.append("files", f));

      const res = await fetch("/api/admin/products", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to save product.");

      router.replace("/admin/products");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {/* Title */}
      <div className="grid gap-2">
        <label className="text-sm">Title</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Minimal Gold Ring"
        />
      </div>

      {/* Categories (from server) */}
      <div className="grid gap-2">
        <label className="text-sm">Categories</label>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-500">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1">
                <input
                  type="checkbox"
                  checked={selectedCats.includes(c.id)}
                  onChange={() => toggleCat(c.id)}
                />
                <span className="text-sm text-gray-600">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="grid gap-2">
        <label className="text-sm">Description</label>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short product details..."
        />
      </div>

      {/* Price & Stock */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label className="text-sm">Price (GHS)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
            value={priceGhs}
            onChange={(e) => setpriceGhs(e.target.value)}
            placeholder="e.g., 68.00"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">Stock</label>
          <input
            type="number"
            min={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="e.g., 5"
          />
        </div>
      </div>

      {/* Status & Images */}
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <label className="text-sm">Status</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
            value={status}
            onChange={(e) => setStatus(e.target.value as "draft" | "published")}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm">Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            className="block w-full text-gray-600"
            onChange={(e) => setFiles(e.target.files)}
          />
          <p className="text-xs text-gray-500">Tip: upload 1–4 images. They’ll be public.</p>
          
        </div>
        {previews.length > 0 && (
            <div className="mt-2">
              <div className="mb-2 text-xs text-gray-500">{previews.length} image(s) selected</div>
              <div className="flex flex-wrap gap-3">
                {previews.map((src, i) => (
                  <img key={i} src={src} className="h-24 w-24 rounded-lg object-cover" />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setFiles(null)}
                className="mt-3 rounded-md border px-3 py-1 text-xs"
              >
                Clear selection
              </button>
            </div>
          )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50">
          {saving ? "Saving..." : "Save product"}
        </button>
        <button type="button" onClick={() => history.back()} className="rounded-lg border border-gray-300 px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}