// ====== Fungsi bersama untuk halaman: lacak, invoice, produk, bandingkan ======
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STATUS_FLOW = ["Menunggu Konfirmasi", "Diproses", "Dikirim", "Selesai"];
const BAYAR_LABEL = { belum: "Belum dibayar", menunggu: "Menunggu pembayaran", lunas: "Lunas", kedaluwarsa: "Tagihan kedaluwarsa", dibatalkan: "Tagihan dibatalkan", refund: "Dana dikembalikan" };
const fmtDate = d => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const parseOrderId = v => { const m = String(v || "").match(/(\d+)/); return m ? Number(m[1]) : null; };
const gmaps = o => `https://www.google.com/maps?q=${o.lokasi_lat},${o.lokasi_lng}`;

function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function updateCartCount() {
  const el = $("#cartCount"); if (!el) return;
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}
async function loadSettings() {
  if (!db) return;
  const { data } = await db.from("settings").select("key,value");
  const wa = (data || []).find(r => r.key === "whatsapp");
  if (wa?.value) STORE.whatsapp = wa.value;
}

// Daftar barang + total pesanan (dipakai lacak & invoice)
function itemsTable(o) {
  const nReq = o.items.filter(i => i.custom && !i.harga).length;
  return `<table class="items-table">
    <thead><tr><th>Produk</th><th class="num">Jml</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
    <tbody>${o.items.map(i => `<tr>
      <td>${i.custom ? `<span class="req-tag">Request</span> ${esc(i.slot ? i.slot + ": " : "")}` : ""}${esc(i.nama)}</td>
      <td class="num">${i.qty}</td>
      <td class="num">${i.custom && !i.harga ? "Menyusul" : rupiah(i.harga)}</td>
      <td class="num">${i.custom && !i.harga ? "Menyusul" : rupiah(i.harga * i.qty)}</td></tr>`).join("")}</tbody>
    <tfoot>
      <tr><td colspan="3">Subtotal</td><td class="num">${rupiah(o.subtotal)}</td></tr>
      ${o.diskon ? `<tr><td colspan="3">Diskon${o.promo ? ` (${esc(o.promo)})` : ""}</td><td class="num">-${rupiah(o.diskon)}</td></tr>` : ""}
      <tr class="grand"><td colspan="3">${nReq ? "Total sementara" : "Total"}</td><td class="num">${rupiah(o.total)}</td></tr>
      ${nReq ? `<tr><td colspan="4" class="note-cell">Belum termasuk ${nReq} komponen request yang harganya sedang dicarikan admin.</td></tr>` : ""}
    </tfoot>
  </table>`;
}

// Pesanan bisa dibayar online jika belum lunas dan semua harga request sudah diisi admin
const canPayOnline = o => o.status !== "Dibatalkan" && o.bayar_status !== "lunas" && o.total >= 10000 &&
  !o.items.some(i => i.custom && !i.harga);

document.addEventListener("DOMContentLoaded", updateCartCount);
