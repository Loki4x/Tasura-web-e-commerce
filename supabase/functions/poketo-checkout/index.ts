// ============================================================
// TASURA — Edge Function: buat tagihan Poketo untuk sebuah pesanan
// POST { orderId: number, hp: string }  →  { paymentUrl, invoiceId, status }
//
// Secrets (Supabase → Edge Functions → Secrets):
//   POKETO_SECRET_KEY   sk_test_… (sandbox) atau sk_live_…
//   SITE_URL            contoh https://tasura-web.vercel.app  (tujuan setelah bayar)
// SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY sudah tersedia otomatis.
// Deploy dengan JWT verification DIMATIKAN (fungsi ini memeriksa nomor HP sendiri).
// ============================================================

const POKETO_API = "https://poketo.id/api/v1";
const env = (k: string) => Deno.env.get(k) ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const normHp = (h: unknown) => {
  const d = String(h ?? "").replace(/\D/g, "");
  return d.startsWith("0") ? "62" + d.slice(1) : d;
};

async function db(path: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function poketo(path: string, body: unknown, idempotencyKey: string) {
  const res = await fetch(`${POKETO_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("POKETO_SECRET_KEY")}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out.error) throw new Error(out.error?.message || `Poketo ${res.status}`);
  return out.data;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!env("POKETO_SECRET_KEY")) return json({ error: "Pembayaran online belum diatur (POKETO_SECRET_KEY kosong)." }, 500);
  try {
    const { orderId, hp } = await req.json().catch(() => ({}));
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) return json({ error: "Nomor pesanan tidak valid." }, 400);

    const [order] = await db(`orders?id=eq.${id}&select=*`);
    // Pesan yang sama untuk "tidak ada" dan "HP salah" agar data pesanan tidak bisa ditebak
    if (!order || normHp(hp).length < 9 || normHp(hp) !== normHp(order.hp)) return json({ error: "Pesanan tidak ditemukan." }, 404);
    if (order.status === "Dibatalkan") return json({ error: "Pesanan ini sudah dibatalkan." }, 409);
    if (order.bayar_status === "lunas") return json({ status: "paid" });
    if ((order.items ?? []).some((i: { custom?: boolean; harga?: number }) => i.custom && !i.harga))
      return json({ error: "Harga komponen request belum dikonfirmasi admin. Tunggu kabar dari admin via WhatsApp." }, 409);
    if (order.total < 10000) return json({ error: "Minimal pembayaran online Rp10.000." }, 409);

    const site = (env("SITE_URL") || req.headers.get("origin") || "").replace(/\/+$/, "");
    const params = {
      amount: order.total,
      title: `Pesanan #TSR-${order.id} — Tasura`,
      description: order.items.map((i: { nama: string; qty: number }) => `${i.nama} ×${i.qty}`).join(", ").slice(0, 480),
      customer: { name: order.nama, phone: order.hp },
      expiresInMinutes: 1440,
      metadata: { orderId: String(order.id) },
      ...(site.startsWith("https://") ? { redirectUrl: `${site}/lacak.html?id=${order.id}` } : {}),
    };
    // referenceId memuat total: jika admin mengubah harga, tagihan baru otomatis dibuat
    let ref = `TSR-${order.id}-${order.total}`;
    let inv = await poketo("/invoices", { ...params, referenceId: ref }, ref);
    if (inv.status === "expired" || inv.status === "cancelled") {
      ref = `${ref}-${Date.now().toString(36)}`;
      inv = await poketo("/invoices", { ...params, referenceId: ref }, ref);
    }
    if (inv.status === "paid") return json({ status: "paid", invoiceId: inv.id });

    await db(`orders?id=eq.${order.id}`, {
      method: "PATCH",
      body: JSON.stringify({ bayar_status: "menunggu", bayar_invoice: inv.id, bayar_url: inv.paymentUrl }),
    });
    return json({ paymentUrl: inv.paymentUrl, invoiceId: inv.id, status: inv.status, totalAmount: inv.totalAmount });
  } catch (e) {
    console.error(e);
    return json({ error: "Gagal membuat tagihan: " + (e instanceof Error ? e.message : String(e)) }, 502);
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve(handler);
