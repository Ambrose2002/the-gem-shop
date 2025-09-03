import type { Product } from "@/types/product";

type Props = {
  product: Product | null;
  onClose: () => void;
  onAdd: (id: string) => void;
};

export default function ProductModal({ product, onClose, onAdd }: Props) {
  if (!product) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-semibold">{product.title}</h3>
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
            Close
          </button>
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="aspect-square overflow-hidden rounded-2xl">
            <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="mt-2 text-sm text-gray-600">{product.description}</p>
            <ul className="mt-4 list-disc pl-5 text-sm text-gray-600">
              <li>Category: {product.category}</li>
              <li>Material: {product.material}</li>
              <li>Availability: {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</li>
            </ul>
            <div className="mt-6 flex gap-3">
              <button className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 hover:bg-gray-100" onClick={onClose}>
                Keep browsing
              </button>
              <button
                className="flex-1 rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
                onClick={() => { onAdd(product.id); onClose(); }}
                disabled={product.stock <= 0}
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}