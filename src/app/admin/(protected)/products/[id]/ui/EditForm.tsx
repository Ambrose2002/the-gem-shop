"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase/client";
import Link from "next/link";

type Product = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  stock: number;
  status: "draft" | "published";
  slug: string;
};
type ImageRow = { id: string; url: string; sort: number };

function pesewasToGhs(cents: number) {
  return (cents / 100).toFixed(2);
}
function ghsToPesewas(v: string) {
  return Math.round((Number(v) || 0) * 100);
}

function makeSafeObjectKey(originalName: string) {
  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : "";
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const normalized = base
    .normalize("NFKD")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const stamp = Date.now();
  return `${stamp}-${normalized || "file"}${ext ? "." + ext : ""}`;
}

/** Extract the storage object key from a public URL. */
function getObjectKeyFromPublicUrl(url: string) {
  // public URL looks like: https://<project>.supabase.co/storage/v1/object/public/product-images/<objectKey>
  const noQuery = url.split("?")[0];
  const idx = noQuery.indexOf("/storage/v1/object/public/product-images/");
  if (idx === -1) return null;
  return noQuery.slice(
    idx + "/storage/v1/object/public/product-images/".length
  );
}

export default function EditForm({
  initial,
  images,
  categories,
  selectedCategoryIds,
}: {
  initial: Product;
  images: ImageRow[];
  categories: { id: string; name: string }[];
  selectedCategoryIds: string[];
}) {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();

  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [priceGhs, setpriceGhs] = useState(pesewasToGhs(initial.price_cents));
  const [stock, setStock] = useState(String(initial.stock));
  const [status, setStatus] = useState<Product["status"]>(initial.status);
  const [newFiles, setNewFiles] = useState<FileList | null>(null);

  const [catIds, setCatIds] = useState<string[]>(selectedCategoryIds);

  function toggleCat(id: string) {
    setCatIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // previews for newly chosen files (existing images are already shown)
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  useEffect(() => {
    if (!newFiles || newFiles.length === 0) {
      setNewPreviews([]);
      return;
    }
    const urls = Array.from(newFiles).map((f) => URL.createObjectURL(f));
    setNewPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newFiles]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      // diff categories
      const current = new Set(selectedCategoryIds);
      const next = new Set(catIds);
      const addCategoryIds = [...next].filter((x) => !current.has(x));
      const removeCategoryIds = [...current].filter((x) => !next.has(x));

      // 1) PATCH product + categories
      const res = await fetch(`/api/admin/products/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          price_cents: ghsToPesewas(priceGhs),
          stock: Math.max(0, Number(stock) || 0),
          status,
          addCategoryIds,
          removeCategoryIds,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok)
        throw new Error(body?.error || "Failed to save product");

      // 2) upload new images (optional)
      if (newFiles && newFiles.length) {
        const form = new FormData();
        Array.from(newFiles).forEach((f) => form.append("files", f));
        const up = await fetch(`/api/admin/products/${initial.id}/images`, {
          method: "POST",
          body: form,
        });
        const upBody = await up.json().catch(() => ({}));
        if (!up.ok || !upBody?.ok)
          throw new Error(upBody?.error || "Failed to upload images");
      }

      router.replace("/admin/products");
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteImage(img: ImageRow) {
    if (!confirm("Delete this image?")) return;
    try {
      setBusyImageId(img.id);
      const res = await fetch(
        `/api/admin/products/${initial.id}/images/${img.id}`,
        { method: "DELETE" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok)
        throw new Error(body?.error || "Failed to delete image");
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to delete image");
    } finally {
      setBusyImageId(null);
    }
  }

  return (
    <form onSubmit={onSave} className="grid gap-6">
      <div className="grid gap-2">
        <label className="text-sm">Title</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Minimal Gold Ring"
        />
      </div>

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

      <div className="grid gap-2">
        <label className="text-sm">Categories</label>
        {categories.length === 0 ? (
          <p className="text-xs text-gray-500">No categories yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1"
              >
                <input
                  type="checkbox"
                  checked={catIds.includes(c.id)}
                  onChange={() => toggleCat(c.id)}
                />
                <span className="text-sm text-gray-600">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-2 text-sm">
          Price (GHS)
          <input
            type="number"
            min={0}
            step="0.01"
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
            value={priceGhs}
            onChange={(e) => setpriceGhs(e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-sm">
          Stock
          <input
            type="number"
            min={0}
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-2 text-sm">
          Status
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
            value={status}
            onChange={(e) => setStatus(e.target.value as Product["status"])}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm">
          Add images
          <input
            type="file"
            multiple
            accept="image/*"
            className="block w-full text-gray-600"
            onChange={(e) => setNewFiles(e.target.files)}
          />
          <p className="text-xs text-gray-500">
            Tip: 1–4 images. Publicly visible.
          </p>
        </label>
      </div>
      {newPreviews.length > 0 && (
        <div className="mt-2">
          <div className="mb-2 text-xs text-gray-500">
            {newPreviews.length} new image(s) to upload
          </div>
          <div className="flex flex-wrap gap-3">
            {newPreviews.map((src, i) => (
              <img
                key={i}
                src={src}
                className="h-24 w-24 rounded-lg object-cover"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setNewFiles(null)}
            className="mt-3 rounded-md border px-3 py-1 text-xs"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="grid gap-2">
        <div className="text-sm">Current images</div>
        {images.length === 0 ? (
          <p className="text-sm text-gray-500">No images yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative">
                <img
                  src={img.url}
                  className="h-24 w-24 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => onDeleteImage(img)}
                  disabled={busyImageId === img.id}
                  className="absolute right-1 top-1 rounded-md bg-white/90 px-2 py-1 text-xs text-red-700 border border-red-200 hover:bg-white disabled:opacity-60"
                  title="Delete image"
                >
                  {busyImageId === img.id ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          onClick={async () => {
            if (
              !confirm(
                "This will permanently remove the product and its images. Continue?"
              )
            )
              return;
            const res = await fetch(
              `/api/admin/products/${initial.id}?hard=1`,
              { method: "DELETE" }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body?.ok)
              return alert(body?.error || "Failed to hard-delete");
            router.replace("/admin/products");
            router.refresh();
          }}
          className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
        >
          Permanently delete
        </button>
        <Link href="/admin/products" className="rounded-lg border px-4 py-2">
          Back
        </Link>
      </div>
    </form>
  );
}
