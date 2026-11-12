// ============================================================
// TASURA — Edge Function: webhook Poketo (status tagihan)
// URL webhook di Poketo: https://<project>.supabase.co/functions/v1/poketo-webhook
//
// Secrets (Supabase → Edge Functions → Secrets):
//   POKETO_WEBHOOK_SECRET   whsec_… (Dashboard Poketo → Merchant → Pengaturan API)
// Deploy dengan JWT verification DIMATIKAN (Poketo tidak mengirim token Supabase;
// keamanan dijamin oleh tanda tangan Poketo-Signature).
// ============================================================

const env = (k: string) => Deno.env.get(k) ?? "";
const text = (body: string, status = 200) => new Response(body, { status });
const MAX_AGE_SECONDS = 300;

async function db(path: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("SUPABASE_URL")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Database ${res.status}: ${t}`);
  return t ? JSON.parse(t) : null;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Poketo-Signature: t=<unix detik>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
export async function verifySignature(raw: string, header: string | null, secret: string, now = Date.now() / 1000) {
  const parts = Object.fromEntries((header ?? "").split(",").map(p => p.trim().split("=")).filter(p => p.length === 2));
  const t = Number(parts.t), v1 = String(parts.v1 ?? "");
  if (!t || !v1 || !secret) return false;
  if (Math.abs(now - t) > MAX_AGE_SECONDS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return safeEqual(sig, v1.toLowerCase());
}

const orderIdOf = (inv: { metadata?: { orderId?: string }; referenceId?: string }) =>
  Number(inv?.metadata?.orderId) || Number(String(inv?.referenceId ?? "").match(/^TSR-(\d+)/)?.[1]) || null;

const methodOf = (pm: unknown) =>
  !pm ? null : typeof pm === "string" ? pm : String((pm as { code?: string; type?: string }).code ?? (pm as { type?: string }).type ?? "online");

export async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return text("Method not allowed", 405);
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("Poketo-Signature"), env("POKETO_WEBHOOK_SECRET")))) {
    return text("invalid signature", 400);
  }
  let event;
  try { event = JSON.parse(raw); } catch { return text("invalid json", 400); }
  const eventId = req.headers.get("Poketo-Event-Id") || event.id;

  try {
    // Lewati event yang sudah pernah diproses (Poketo bisa mengirim ulang)
    if (eventId) {
      const seen = await db(`payment_events?id=eq.${encodeURIComponent(eventId)}&select=id`);
      if (seen?.length) return text("ok (duplicate)");
    }
    const inv = event.data ?? {};
    const orderId = orderIdOf(inv);
    if (event.type?.startsWith("invoice.") && orderId) {
      const [order] = await db(`orders?id=eq.${orderId}&select=id,status,total,bayar_invoice,bayar_status,catatan_admin`);
      if (order) {
        const patch: Record<string, unknown> = {};
        const sameInvoice = !order.bayar_invoice || order.bayar_invoice === inv.id;
        const note = (s: string) => { patch.catatan_admin = [order.catatan_admin, s].filter(Boolean).join("\n").slice(0, 2000); };
        if (event.type === "invoice.paid") {
          if (Number(inv.amount) >= Number(order.total)) {
            Object.assign(patch, { bayar_status: "lunas", dibayar_at: inv.paidAt ?? new Date().toISOString(), bayar_metode: methodOf(inv.paymentMethod), bayar_invoice: inv.id });
            if (order.status === "Menunggu Konfirmasi") patch.status = "Diproses";
          }
          note(`[Poketo] Dibayar Rp${Number(inv.amount).toLocaleString("id-ID")} (${inv.id}, ${event.environment ?? ""})` +
            (Number(inv.amount) < Number(order.total) ? ` — KURANG dari total pesanan Rp${Number(order.total).toLocaleString("id-ID")}, cek manual.` : ""));
        } else if (sameInvoice && order.bayar_status !== "lunas") {
          const map: Record<string, string> = { "invoice.expired": "kedaluwarsa", "invoice.cancelled": "dibatalkan", "invoice.refunded": "refund" };
          if (map[event.type]) patch.bayar_status = map[event.type];
        } else if (event.type === "invoice.refunded") {
          patch.bayar_status = "refund"; note(`[Poketo] Pembayaran ${inv.id} dikembalikan (refund/chargeback).`);
        }
        if (Object.keys(patch).length) await db(`orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify(patch) });
      }
    }
    if (eventId) await db("payment_events", { method: "POST", body: JSON.stringify({ id: eventId, type: event.type ?? "", invoice: inv.id ?? null }) });
    return text("ok");
  } catch (e) {
    console.error(e);
    return text("error", 500); // Poketo akan mencoba lagi
  }
}

if (typeof Deno !== "undefined" && typeof Deno.serve === "function") Deno.serve(handler);
