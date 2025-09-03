import type { Product } from "@/types/product";

type Props = {
  product: Product;
  onQuickView?: (p: Product) => void;
  onAddToCart?: (id: string) => void;
};

function priceToUSD(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function ProductCard({ product, onQuickView, onAddToCart }: Props) {
  const out = product.stock <= 0;
  return (
    <div className="group rounded-2xl bg-white p-3 shadow-sm">
      <div className="relative aspect-square overflow-hidden rounded-xl">
        <img
          src={product.images?.[0]}
          alt={product.title}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        {out && (
          <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-gray-700">
            Out of stock
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-gray-900">{product.title}</h3>
            <p className="text-xs text-gray-500">{product.material}</p>
          </div>
          <div className="text-sm font-semibold">{priceToUSD(product.price)}</div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onQuickView?.(product)}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
          >
            Quick view
          </button>
          <button
            onClick={() => onAddToCart?.(product.id)}
            disabled={out}
            className="flex-1 rounded-xl bg-black px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}