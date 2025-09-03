import type { Product } from "@/types/product";

type Line = { product: Product; quantity: number };

type Props = {
  open: boolean;
  lines: Line[];
  subtotal: number;
  onClose: () => void;
  onRemove: (id: string) => void;
  onQty: (id: string, q: number) => void;
  onCheckout: () => void;
};

function priceToUSD(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function CartDrawer({
  open,
  lines,
  subtotal,
  onClose,
  onRemove,
  onQty,
  onCheckout,
}: Props) {
  return (
    <div
      className={`fixed inset-y-0 right-0 z-30 w-full max-w-md transform bg-white shadow-2xl transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Your cart</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {lines.length === 0 ? (
            <p className="text-sm text-gray-600">Your cart is empty.</p>
          ) : (
            lines.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-xl border p-3"
              >
                <div className="h-16 w-16 overflow-hidden rounded-lg">
                  {product.images?.[0] ? (
                    <img
                      className="h-full w-full object-cover"
                      src={product.images[0]}
                      alt={product.title}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 bg-gray-100">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{product.title}</div>
                      <div className="text-xs text-gray-500">
                        {product.material} · {product.category}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {priceToUSD(product.price * quantity)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-gray-500">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(0, product.stock)} // ← stock-aware
                      value={Math.min(quantity, Math.max(0, product.stock))} // keep UI in sync
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 0;
                        const clamped = Math.max(
                          1,
                          Math.min(product.stock, raw)
                        ); // ← stock-aware clamp
                        onQty(product.id, clamped);
                      }}
                      disabled={product.stock <= 0}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    {product.stock <= 0 ? (
                      <span className="text-xs text-red-600">Out of stock</span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Max {product.stock}
                      </span>
                    )}
                    <button
                      onClick={() => onRemove(product.id)}
                      className="ml-auto rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-semibold">{priceToUSD(subtotal)}</span>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Shipping calculated after purchase. Taxes shown at checkout.
          </p>
          <button
            onClick={onCheckout}
            disabled={lines.length === 0}
            className="w-full rounded-xl bg-black px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
