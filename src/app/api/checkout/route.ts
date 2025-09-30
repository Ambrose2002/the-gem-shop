import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const PAYSTACK_BASE = "https://api.paystack.co";

type PackageSelectionInput = {
  packageId?: string;
  quantity?: number;
};

type PackageLineInput = {
  productId?: string;
  selections?: PackageSelectionInput[];
};

type CheckoutBody = {
  name?: string;
  phone?: string;
  city?: string;
  address?: string;
  deliveryPayment?: "before" | "after";
  packages?: PackageLineInput[];
};

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            jar.set({ name, value, ...options })
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse request body for phone + city + address + deliveryPayment
  const body: CheckoutBody = await req
    .json()
    .catch(() => ({} as CheckoutBody));
  const customerName = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const city = (body.city ?? "").trim();
  const address = (body.address ?? "").trim();
  const deliveryPayment: "before" | "after" = body.deliveryPayment === "after" ? "after" : "before"; // default

  const rawPackageLines = Array.isArray(body.packages) ? body.packages : [];
  const packageSelectionsByLine = new Map<
    string,
    Array<{ packageId: string; quantity: number }>
  >();

  rawPackageLines.forEach((line) => {
    const productId =
      line && typeof line === "object" && typeof line.productId === "string"
        ? line.productId
        : null;
    if (!productId) return;

    const selections = Array.isArray(line.selections) ? line.selections : [];
    const normalized = selections
      .map((sel) => {
        if (!sel || typeof sel !== "object") return null;
        const packageId =
          typeof sel.packageId === "string" ? sel.packageId : null;
        const quantityRaw = Number(sel.quantity ?? 0);
        const quantity = Number.isFinite(quantityRaw)
          ? Math.max(0, Math.floor(quantityRaw))
          : 0;
        return packageId && quantity > 0 ? { packageId, quantity } : null;
      })
      .filter(Boolean) as Array<{ packageId: string; quantity: number }>;

    if (normalized.length) {
      packageSelectionsByLine.set(productId, normalized);
    }
  });

  const GH_PHONE = /^(\+233\d{9}|0\d{9})$/;
  if (!customerName || !GH_PHONE.test(phone) || city.length < 2 || address.length < 3) {
    return NextResponse.json({ error: "Invalid contact details" }, { status: 400 });
  }

  // Helper to normalize product relation (can be object or array)
  type ProductMini = { title: string; price_cents: number };
  const pickProduct = (p: ProductMini | ProductMini[] | null): ProductMini | null => Array.isArray(p) ? (p[0] ?? null) : p;

  type CartItemRow = {
    product_id: string;
    quantity: number;
    products: ProductMini | ProductMini[] | null;
  };

  // Load cart and items (same as before)
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) return NextResponse.json({ error: "Cart empty" }, { status: 400 });

  const { data: items } = await supabase
    .from("cart_items")
    .select("product_id, quantity, products(title, price_cents)")
    .eq("cart_id", cart.id);

  const lines = ((items as CartItemRow[] | null) ?? [])
    .map((r) => {
      const prod = pickProduct(r.products ?? null);
      const unit = Number(prod?.price_cents ?? 0);
      const qty = Number(r.quantity ?? 0);
      return {
        product_id: r.product_id as string,
        title: (prod?.title ?? "") as string,
        unit,
        qty,
        total: unit * qty,
      };
    })
    .filter((l) => l.qty > 0);

  let amount_cents = lines.reduce((s, l) => s + l.total, 0);
  if (amount_cents <= 0)
    return NextResponse.json({ error: "Cart empty" }, { status: 400 });

  const packageDrafts: Array<{
    product_id: string;
    title: string;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
    for_product_id: string;
  }> = [];

  const lineByProduct = new Map(lines.map((line) => [line.product_id, line]));

  if (packageSelectionsByLine.size) {
    const totalByPackage = new Map<string, number>();

    for (const [productId, selections] of packageSelectionsByLine.entries()) {
      const line = lineByProduct.get(productId);
      if (!line) continue;

      const totalForLine = selections.reduce(
        (sum, sel) => sum + sel.quantity,
        0
      );
      if (totalForLine > line.qty) {
        return NextResponse.json(
          {
            error: `Too many packages selected for "${line.title}". You can choose at most ${line.qty}.`,
          },
          { status: 400 }
        );
      }

      selections.forEach(({ packageId, quantity }) => {
        totalByPackage.set(
          packageId,
          (totalByPackage.get(packageId) ?? 0) + quantity
        );
      });
    }

    const packageIds = [...totalByPackage.keys()];
    if (packageIds.length) {
      const { data: packageCategory } = await supabase
        .from("categories")
        .select("id")
        .ilike("name", "package")
        .maybeSingle();

      if (!packageCategory) {
        return NextResponse.json(
          { error: "Packaging options are not available right now." },
          { status: 400 }
        );
      }

      const { data: packageLinks, error: linkErr } = await supabase
        .from("product_categories")
        .select("product_id")
        .eq("category_id", packageCategory.id)
        .in("product_id", packageIds);

      if (linkErr) {
        return NextResponse.json({ error: linkErr.message }, { status: 400 });
      }

      const allowedPackageIds = new Set(
        (packageLinks ?? []).map((l) => l.product_id as string)
      );

      for (const pkgId of packageIds) {
        if (!allowedPackageIds.has(pkgId)) {
          return NextResponse.json(
            { error: "Selected package is not available." },
            { status: 400 }
          );
        }
      }

      const { data: packagesData, error: pkgErr } = await supabase
        .from("products")
        .select("id, title, price_cents, stock, status, deleted_at")
        .in("id", packageIds);

      if (pkgErr) {
        return NextResponse.json({ error: pkgErr.message }, { status: 400 });
      }

      const packagesInfo = new Map(
        (packagesData ?? [])
          .filter((pkg) => pkg.status === "published" && !pkg.deleted_at)
          .map((pkg) => [pkg.id as string, pkg])
      );

      for (const pkgId of packageIds) {
        const pkg = packagesInfo.get(pkgId);
        if (!pkg) {
          return NextResponse.json(
            { error: "Selected package is unavailable." },
            { status: 400 }
          );
        }
        const stock = Math.max(0, Number(pkg.stock ?? 0));
        const requested = totalByPackage.get(pkgId) ?? 0;
        if (requested > stock) {
          return NextResponse.json(
            {
              error: `Not enough stock for package "${pkg.title}"`,
            },
            { status: 400 }
          );
        }
      }

      for (const [productId, selections] of packageSelectionsByLine.entries()) {
        const line = lineByProduct.get(productId);
        if (!line) continue;

        selections.forEach(({ packageId, quantity }) => {
          const pkg = packagesInfo.get(packageId);
          if (!pkg) return;

          const unitPrice = Number(pkg.price_cents ?? 0);
          const lineTotal = unitPrice * quantity;
          amount_cents += lineTotal;

          packageDrafts.push({
            product_id: packageId,
            title: `Package: ${pkg.title} (for ${line.title})`,
            unit_price_cents: unitPrice,
            quantity,
            line_total_cents: lineTotal,
            for_product_id: productId,
          });
        });
      }
    }
  }

  // Insert order with phone + city + address + delivery_payment
  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      amount_cents,
      currency: "GHS",
      status: "pending",
      provider: "paystack",
      phone,
      city,
      address,
      delivery_payment: deliveryPayment,
    })
    .select("id")
    .single();
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  const orderLineRows = lines.map((l) => ({
    order_id: order.id,
    product_id: l.product_id,
    title: l.title,
    unit_price_cents: l.unit,
    quantity: l.qty,
    line_total_cents: l.total,
  }));

  const packageLineRows = packageDrafts.map((draft) => ({
    order_id: order.id,
    product_id: draft.product_id,
    title: draft.title,
    unit_price_cents: draft.unit_price_cents,
    quantity: draft.quantity,
    line_total_cents: draft.line_total_cents,
  }));

  if (orderLineRows.length || packageLineRows.length) {
    await supabase
      .from("order_items")
      .insert([...orderLineRows, ...packageLineRows]);
  }

  // Initialize Paystack
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const paystackMetadata: Record<string, unknown> = {
    order_id: order.id,
    customerName,
    phone,
    city,
    address,
    deliveryPayment,
    user_id: user.id,
  };

  if (packageDrafts.length) {
    paystackMetadata.packages = packageDrafts.map((draft) => ({
      package_id: draft.product_id,
      for_product_id: draft.for_product_id,
      quantity: draft.quantity,
      unit_price_cents: draft.unit_price_cents,
    }));
  }

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email ?? "customer@example.com",
      amount: amount_cents,
      currency: "GHS",
      reference: order.id,
      callback_url: `${site}/payment/callback`,
      metadata: paystackMetadata,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data?.status) {
    return NextResponse.json({ error: data?.message ?? "Payment init failed" }, { status: 400 });
  }

  return NextResponse.json({ url: data.data.authorization_url });
}
