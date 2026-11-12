// ====== TASURA — Lacak pesanan ======
let current = null, currentHp = "";

function timeline(o) {
  if (o.status === "Dibatalkan") return `<div class="timeline cancelled"><div class="step done"><span>✕</span><b>Pesanan dibatalkan</b></div></div>`;
  const idx = STATUS_FLOW.indexOf(o.status);
  const desc = {
    "Menunggu Konfirmasi": "Pesanan diterima, admin sedang mengecek.",
    "Diproses": "Pesanan dikonfirmasi & sedang disiapkan/dirakit.",
    "Dikirim": "Paket dalam perjalanan.",
    "Selesai": "Pesanan sudah diterima. Terima kasih!",
  };
  return `<div class="timeline">${STATUS_FLOW.map((s, i) => `
    <div class="step ${i < idx ? "done" : i === idx ? "now" : ""}"><span>${i < idx ? "✓" : i + 1}</span><b>${s}</b><small>${desc[s]}</small></div>`).join("")}</div>`;
}

function render(o) {
  const lunas = o.bayar_status === "lunas";
  $("#result").innerHTML = `
    <div class="track-card">
      <div class="track-head">
        <div><span class="muted">Nomor pesanan</span><h2>#TSR-${o.id}</h2><span class="muted">${fmtDate(o.created_at)}</span></div>
        <div class="track-badges">
          <span class="status ${"s-" + o.status.split(" ")[0].toLowerCase()}">${esc(o.status)}</span>
          <span class="pay-badge ${lunas ? "paid" : ""}">${lunas ? "✓ " : ""}${BAYAR_LABEL[o.bayar_status] || "Belum dibayar"}</span>
        </div>
      </div>
      ${timeline(o)}
      ${o.resi ? `<div class="resi-box"><div><span class="muted">Nomor resi</span><b id="resiText">${esc(o.resi)}</b></div>
        <div class="resi-actions"><button class="btn btn-ghost sm" id="copyResi">Salin</button>
        <a class="btn btn-primary sm" target="_blank" rel="noopener" href="https://cekresi.com/?noresi=${encodeURIComponent(o.resi)}">Lacak Paket</a></div></div>` : ""}
      <div id="payBox"></div>
      <h3>Rincian Pesanan</h3>
      ${itemsTable(o)}
      <div class="track-grid">
        <div><h4>Pengiriman</h4><p><b>${esc(o.nama)}</b><br>${esc(o.hp)}<br>${esc(o.alamat)}</p>
          ${o.lokasi_lat != null ? `<a class="link" target="_blank" rel="noopener" href="${gmaps(o)}">📍 Lihat titik lokasi</a>` : ""}</div>
        <div><h4>Pembayaran</h4><p>${esc(o.pembayaran)}${o.bayar_metode ? ` • ${esc(o.bayar_metode)}` : ""}${o.dibayar_at ? `<br><span class="muted">Dibayar ${fmtDate(o.dibayar_at)}</span>` : ""}</p>
          ${o.catatan ? `<h4>Catatan</h4><p class="muted">${esc(o.catatan)}</p>` : ""}</div>
      </div>
      <div class="track-actions">
        <a class="btn btn-ghost" href="invoice.html?id=${o.id}&hp=${encodeURIComponent(currentHp)}" target="_blank">🧾 Lihat Invoice</a>
        <a class="btn btn-wa" target="_blank" href="https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(`Halo ${STORE.nama}, saya mau tanya pesanan #TSR-${o.id} atas nama ${o.nama}.`)}">💬 Tanya Admin</a>
      </div>
    </div>`;
  if (typeof Pay !== "undefined") Pay.mount($("#payBox"), o, currentHp, refresh);
  $("#copyResi")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(o.resi); toast("Nomor resi disalin ✓"); } catch { prompt("Salin nomor resi:", o.resi); }
  });
}

async function lookup(idRaw, hp) {
  const err = $("#trackError"); err.hidden = true;
  const id = parseOrderId(idRaw);
  if (!id) { err.textContent = "Nomor pesanan tidak valid. Contoh: #TSR-12"; err.hidden = false; return; }
  if (!db) { err.textContent = "Fitur lacak belum aktif (database belum tersambung). Silakan tanya admin via WhatsApp."; err.hidden = false; return; }
  const btn = $("#trackForm button"); btn.disabled = true; btn.textContent = "Mencari...";
  const { data, error } = await db.rpc("track_order", { p_id: id, p_hp: hp });
  btn.disabled = false; btn.textContent = "Lacak";
  if (error) {
    err.textContent = /function/i.test(error.message) ? "Fitur lacak belum aktif. Silakan tanya admin via WhatsApp." : "Gagal mencari pesanan: " + error.message;
    err.hidden = false; return;
  }
  if (!data) { err.textContent = "Pesanan tidak ditemukan. Periksa lagi nomor pesanan dan nomor WhatsApp-nya."; err.hidden = false; $("#result").innerHTML = ""; return; }
  current = data; currentHp = hp;
  sessionStorage.setItem("tasura_track", JSON.stringify({ id, hp }));
  render(data);
}
const refresh = () => current && lookup(String(current.id), currentHp);

$("#trackForm").onsubmit = e => { e.preventDefault(); const f = e.target; lookup(f.id.value, f.hp.value); };

(async () => {
  await loadSettings();
  if (typeof Pay !== "undefined") await Pay.init().catch(() => {});
  const q = new URLSearchParams(location.search);
  const saved = JSON.parse(sessionStorage.getItem("tasura_track") || "null");
  const id = q.get("id") || saved?.id, hp = q.get("hp") || (saved && String(saved.id) === String(parseOrderId(q.get("id") || saved.id)) ? saved.hp : "");
  if (id) $("#trackForm").id.value = "#TSR-" + parseOrderId(id);
  if (hp) $("#trackForm").hp.value = hp;
  if (q.has("hp")) history.replaceState(null, "", location.pathname + (id ? `?id=${parseOrderId(id)}` : ""));
  if (id && hp) lookup(String(id), hp);
})();
