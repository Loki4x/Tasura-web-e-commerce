// ====== TASURA — Invoice (cetak / simpan PDF dari browser) ======
function renderInvoice(o) {
  const lunas = o.bayar_status === "lunas";
  document.title = `Invoice #TSR-${o.id} — Tasura`;
  $("#invoice").innerHTML = `
    ${lunas ? `<div class="paid-stamp">LUNAS</div>` : ""}
    <header class="inv-head">
      <div><div class="logo">Tasura</div><p class="muted">PC Rakitan, Monitor & Komponen Komputer<br>WhatsApp: +${esc(STORE.whatsapp)}<br>${esc(location.host)}</p></div>
      <div class="inv-meta"><h1>INVOICE</h1>
        <table><tr><td>No.</td><td><b>#TSR-${o.id}</b></td></tr>
        <tr><td>Tanggal</td><td>${fmtDate(o.created_at)}</td></tr>
        <tr><td>Status</td><td>${esc(o.status)}</td></tr>
        <tr><td>Pembayaran</td><td>${esc(BAYAR_LABEL[o.bayar_status] || "Belum dibayar")}</td></tr></table></div>
    </header>
    <section class="inv-to">
      <div><h4>Ditagihkan kepada</h4><p><b>${esc(o.nama)}</b><br>${esc(o.hp)}<br>${esc(o.alamat)}</p></div>
      <div><h4>Metode pembayaran</h4><p>${esc(o.pembayaran)}${o.bayar_metode ? ` (${esc(o.bayar_metode)})` : ""}${o.dibayar_at ? `<br>Dibayar ${fmtDate(o.dibayar_at)}` : ""}</p>
        ${o.resi ? `<h4>No. resi</h4><p>${esc(o.resi)}</p>` : ""}</div>
    </section>
    ${itemsTable(o)}
    ${o.catatan ? `<p class="inv-note"><b>Catatan:</b> ${esc(o.catatan)}</p>` : ""}
    <footer class="inv-foot">Terima kasih telah berbelanja di Tasura. Simpan invoice ini sebagai bukti pembelian dan untuk klaim garansi.</footer>`;
}

(async () => {
  const q = new URLSearchParams(location.search);
  const id = parseOrderId(q.get("id")), hp = q.get("hp");
  const fail = m => { $("#invoice").innerHTML = `<p class="msg error">${esc(m)}</p>`; };
  if (!id) return fail("Nomor pesanan tidak ada.");
  if (!db) return fail("Database belum tersambung.");
  await loadSettings();
  let o = null;
  if (hp) { const r = await db.rpc("track_order", { p_id: id, p_hp: hp }); o = r.data; }
  if (!o) { // pemilik akun atau admin yang sedang login
    try {
      const { data } = await db.auth.getSession();
      if (data.session) { const r = await db.from("orders").select("*").eq("id", id).maybeSingle(); o = r.data; }
    } catch (e) { console.warn(e); }
  }
  if (!o) return fail("Invoice tidak ditemukan. Buka invoice dari halaman Lacak Pesanan atau masuk ke akunmu.");
  renderInvoice(o);
})();
