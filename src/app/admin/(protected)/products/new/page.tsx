"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import { createClientBrowser } from "@/lib/supabase/client";

function baseSlugFromTitle(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function ensureUniqueSlug(
  supabase: ReturnType<typeof createClientBrowser>,
  baseSlug: string
) {
  // Fetch slugs that start with baseSlug (case-insensitive)
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .ilike("slug", `${baseSlug}%`);

  if (error || !data) return baseSlug;

  const existing = new Set(data.map((r) => r.slug));
  if (!existing.has(baseSlug)) return baseSlug;

  // Try -2, -3, ... -199
  for (let i = 2; i < 200; i++) {
    const candidate = `${baseSlug}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  // Final fallback
  return `${baseSlug}-${Date.now()}`;
}

function makeSafeObjectKey(originalName: string) {
  // Keep extension
  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : "";
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;

  // Normalize, drop weird unicode, keep [a-z0-9-_], collapse dashes
  const normalized = base
    .normalize("NFKD")
    .replace(/[^\w\-]+/g, "-") // replace spaces & special chars with '-'
    .replace(/-+/g, "-") // collapse multiple dashes
    .replace(/^-|-$/g, "") // trim leading/trailing dashes
    .toLowerCase();

  const stamp = Date.now();
  return `${stamp}-${normalized || "file"}${ext ? "." + ext : ""}`;
}

export default function NewProductPage() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [priceUsd, setPriceUsd] = useState<string>("");
  const [stock, setStock] = useState<string>("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [files, setFiles] = useState<FileList | null>(null);

  const [allCategories, setAllCategories] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name")
        .order("name", { ascending: true });
      setAllCategories(data ?? []);
    })();
  }, []);

  function toggleCat(id: string) {
    setSelectedCats((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // previews
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    if (!files || files.length === 0) {
      setPreviews([]);
      return;
    }
    const urls = Array.from(files).map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [files]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    // Basic validation
    if (!title.trim()) return setErr("Title is required.");
    const price_cents = Math.round((Number(priceUsd) || 0) * 100);
    if (price_cents < 0) return setErr("Price must be >= 0.");
    const stockInt = Number(stock);
    if (!Number.isFinite(stockInt) || stockInt < 0)
      return setErr("Stock must be >= 0.");

    setSaving(true);
    try {
      const base = baseSlugFromTitle(title);
      const slug = await ensureUniqueSlug(supabase, base);

      // 1) Create product
      const { data: product, error: prodErr } = await supabase
        .from("products")
        .insert({
          title,
          slug,
          description,
          price_cents,
          stock: stockInt,
          status,
        })
        .select("id")
        .single();

      if (prodErr) throw prodErr;

      // 2) Upload images to Storage (optional)
      if (files && files.length > 0) {
        const bucket = "product-images";
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const safeName = makeSafeObjectKey(file.name);
          const objectPath = `${product.id}/${safeName}`;

          const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(objectPath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || undefined, // helps with correct mime type
            });

          if (uploadErr) throw uploadErr;

          const { data: pub } = await supabase.storage
            .from(bucket)
            .getPublicUrl(objectPath);
          await supabase.from("product_images").insert({
            product_id: product.id,
            url: pub.publicUrl,
            sort: i,
          });
        }
      }

      if (selectedCats.length > 0) {
        const rows = selectedCats.map((cid) => ({
          product_id: product.id,
          category_id: cid,
        }));
        const { error: pcErr } = await supabase
          .from("product_categories")
          .insert(rows);
        if (pcErr) throw pcErr;
      }

      // Go back to products list
      router.replace("/admin/products");
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="New product">
      <form onSubmit={onSubmit} className="grid gap-4">
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
          <label className="text-sm">Categories</label>
          {allCategories.length === 0 ? (
            <p className="text-xs text-gray-500">No categories yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allCategories.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1"
                >
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

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm">Price (USD)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
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

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-sm">Status</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-600"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "draft" | "published")
              }
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
            <p className="text-xs text-gray-500">
              Tip: upload 1–4 images. They’ll be public.
            </p>
          </div>
          {previews.length > 0 && (
            <div className="mt-2">
              <div className="mb-2 text-xs text-gray-500">
                {previews.length} image(s) selected
              </div>
              <div className="flex flex-wrap gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative">
                    <img
                      src={src}
                      className="h-24 w-24 rounded-lg object-cover"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setFiles(null);
                }}
                className="mt-3 rounded-md border px-3 py-1 text-xs"
              >
                Clear selection
              </button>
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
            {saving ? "Saving..." : "Save product"}
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="rounded-lg border border-gray-300 px-4 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </AdminShell>
  );
}
