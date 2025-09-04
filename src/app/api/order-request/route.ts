import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { Resend } from "resend";

export async function POST(req: Request) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value, options }) =>
            jar.set({ name, value, ...options })
          );
        },
      },
    }
  );

  // must be signed in
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );

  // optional contact payload from the form
  // optional contact payload from the form
  const payload = await req.json().catch(() => ({} as any));
  const contact = {
    name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    email: user.email || "",
    phone: payload?.phone || "",
    city: payload?.city || "",
  };

  // simple validation (optional)
  if (!contact.phone || !contact.city) {
    return NextResponse.json(
      { ok: false, error: "Phone and city are required." },
      { status: 400 }
    );
  }

  // ensure active cart
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!cart)
    return NextResponse.json(
      { ok: false, error: "Cart is empty" },
      { status: 400 }
    );

  // load items + product details
  const { data: lines, error: liErr } = await supabase
    .from("cart_items")
    .select("product_id, quantity, products(title, price_cents, stock)")
    .eq("cart_id", cart.id);
  if (liErr)
    return NextResponse.json(
      { ok: false, error: liErr.message },
      { status: 500 }
    );
  if (!lines || lines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Cart is empty" },
      { status: 400 }
    );
  }

  // get first image per product (optional, for nicer email)
  const productIds = lines.map((l) => l.product_id);
  const { data: imgs } = await supabase
    .from("product_images")
    .select("product_id, url, sort")
    .in("product_id", productIds)
    .order("sort", { ascending: true });

  const firstImg = new Map<string, string>();
  (imgs ?? []).forEach((i) => {
    if (!firstImg.has(i.product_id)) firstImg.set(i.product_id, i.url);
  });

  // compute totals
  const subtotalCents = lines.reduce((sum, l: any) => {
    const price = Number(l.products?.price_cents ?? 0);
    const qty = Number(l.quantity ?? 0);
    return sum + price * qty;
  }, 0);

  // Compose a simple HTML email
  const currency = "GHS";
  const fmt = (cents: number) => (cents / 100).toFixed(2);

  const rowsHtml = lines
    .map((l: any) => {
      const title = l.products?.title ?? "(untitled)";
      const price = Number(l.products?.price_cents ?? 0);
      const qty = Number(l.quantity ?? 0);
      const img = firstImg.get(l.product_id);
      return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;">
          ${
            img
              ? `<img src="${img}" alt="" width="56" height="56" style="object-fit:cover;border-radius:8px;display:block;margin-right:8px;" />`
              : ""
          }
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          <div style="font-weight:600">${title}</div>
          <div style="color:#666;font-size:12px;">Qty: ${qty}</div>
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">
          ₵${fmt(price)}<br/>
          <span style="color:#666;font-size:12px;">Line: ₵${fmt(
            price * qty
          )}</span>
        </td>
      </tr>
    `;
    })
    .join("");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <h2 style="margin:0 0 12px 0;">New Order Request</h2>
    <p style="margin:0 0 8px 0;">
      From: <strong>${contact.name || "Customer"}</strong>
      &lt;${contact.email}&gt;
    </p>
    <p style="margin:0 0 16px 0;">
      Phone: ${contact.phone} &nbsp;•&nbsp; City: ${contact.city}
    </p>

    <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;border-collapse:collapse;">
      ${rowsHtml}
      <tr>
        <td></td>
        <td style="padding:8px;text-align:right;font-weight:600;">Subtotal</td>
        <td style="padding:8px;text-align:right;font-weight:600;">₵${fmt(
          subtotalCents
        )} ${currency}</td>
      </tr>
    </table>

    <p style="margin-top:16px;color:#666;font-size:12px;">
      (No payment was collected. Please coordinate offline.)
    </p>
  </div>
`;

  // Send the email
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const to = process.env.STORE_OWNER_EMAIL!;

  try {
    const { error: sendErr } = (await resend.emails.send({
      from: `The Real Gem Shop <${process.env.FROM_EMAIL!}>`,
      to,
      subject: `Order request from ${contact.name || user.email || "customer"}`,
      html,
      replyTo: contact.email || undefined,
    })) as any;
    if (sendErr) throw new Error(sendErr.message || "Failed to send");
    await supabase.from("cart_items").delete().eq("cart_id", cart.id);

    return NextResponse.json({ ok: true, cleared: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message ?? "Email failed" },
      { status: 500 }
    );
  }
}
