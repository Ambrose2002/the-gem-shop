"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteProductButton({
  id,
  title,
  hard = false,
}: {
  id: string;
  title: string;
  hard?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    const msg = hard
      ? `This will permanently delete "${title}" and its images. Continue?`
      : `Soft-delete "${title}"?`;
    if (!confirm(msg)) return;

    try {
      setBusy(true);
      const res = await fetch(
        `/api/admin/products/${id}${hard ? "?hard=1" : ""}`,
        { method: "DELETE" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        alert(body?.error || "Failed to delete");
        return;
      }
      // Refresh the list
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-red-600 underline disabled:opacity-50"
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}