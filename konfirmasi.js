// ====== TASURA — Konfirmasi pesanan ======
// Bayar otomatis via Poketo, atau konfirmasi ke admin via WhatsApp.
let O = null, M = null, WA = "", HP = "";
const isPoketo = () => (M ? M.online : / \(Poketo\)$/.test(O?.pembayaran || "")) && !!O?.id;
const waLink = () => `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(WA ||
  `Halo ${STORE.nama}, saya mau konfirmasi pesanan *#TSR-${O.id}* atas nama ${O.nama}.\nTotal: ${rupiah(O.total)}\nPembayaran: ${O.pembayaran}\n\nMohon info pembayarannya ya, terima kasih 🙏`)}`;

function actionBox() {
  const lunas = O.bayar_status === "lunas";
  const unpriced = O.items.some(i => i.custom && !i.harga);
  const methodName = M?.name || String(O.pembayaran || "").replace(/ \((Poketo|via Admin)\)$/, "");
  if (lunas) return `<div class="action-box done"><h3>✓ Pembayaran diterima</h3><p>Terima kasih! Pesananmu sedang kami proses. Pantau statusnya di halaman Lacak Pesanan.</p>
    <a class="btn btn-primary" href="lacak.html?id=${O.id}&hp=${encodeURIComponent(HP)}">Lacak Pesanan</a></div>`;
  if (O.status === "Dibatalkan") return `<div class="action-box"><h3>Pesanan dibatalkan</h3><p class="muted">Hubungi admin bila ada pertanyaan.</p><a class="btn btn-wa-green" target="_blank" href="${waLink()}">💬 Hubungi Admin</a></div>`;

  if (isPoketo() && !unpriced) {
    // Pesanan lama menyimpan satu metode (fee), pesanan baru menyimpan kisaran biaya (feeMin–feeMax)
    const lo = M?.feeMin ?? M?.fee, hi = M?.feeMax ?? M?.fee, single = M?.code && M.code !== "AUTO";
    const range = (a, b) => a === b ? rupiah(a) : `${rupiah(a)} – ${rupiah(b)}`;
    const label = single ? esc(methodName) : "QRIS, Bank (VA), Akulaku PayLater, atau Kartu Debit";
    return `<div class="action-box">
      <span class="step-tag">Langkah terakhir</span>
      <h3>⚡ ${single ? `Bayar dengan ${esc(methodName)}` : "Pembayaran Otomatis"}</h3>
      <p class="muted">Pembayaran diproses Poketo. Setelah berhasil, status pesanan otomatis menjadi <b>Lunas</b> — tidak perlu kirim bukti transfer.</p>
      <div class="pay-sum">
        <div class="row"><span>Total pesanan</span><span>${rupiah(O.total)}</span></div>
        ${lo != null ? `<div class="row"><span>Biaya layanan${single ? " " + esc(methodName) : " (sesuai metode)"}${M.estimated ? ", perkiraan" : ""}</span><span>+${range(lo, hi)}</span></div>
        <div class="row total-row"><span>Total dibayar</span><b>${range(O.total + lo, O.total + hi)}</b></div>` : ""}
      </div>
      <p class="msg error" id="payErr" hidden></p>
      <button class="btn btn-primary full big" id="payBtn">💳 Bayar Sekarang via Poketo</button>
      <small class="muted">Di halaman Poketo, pilih <b>${label}</b>. Link pembayaran berlaku 24 jam dan bisa dibuka lagi dari halaman Lacak Pesanan.</small>
      <a class="link center-text" target="_blank" href="${waLink()}">Ada kendala? Konfirmasi via WhatsApp</a>
    </div>`;
  }

  return `<div class="action-box">
    <span class="step-tag">Langkah terakhir</span>
    <h3>💬 Konfirmasi via WhatsApp</h3>
    ${unpriced ? `<p class="muted">Pesananmu berisi komponen request. Admin akan mencarikan komponennya lalu mengabari harga totalnya.${isPoketo() ? " Setelah harga dikonfirmasi, kamu bisa bayar via Poketo dari halaman Lacak Pesanan." : ""}</p>` : ""}
    <ol class="steps-list">
      <li>Klik tombol di bawah untuk mengirim detail pesanan ke admin.</li>
      <li>Admin mengirim info pembayaran <b>${esc(methodName)}</b> (kode QRIS / nomor rekening / e-wallet).</li>
      <li>Kirim bukti pembayaran, lalu pesanan diproses.</li>
    </ol>
    <a class="btn btn-wa-green full big" id="waBtn" target="_blank" href="${waLink()}">💬 Konfirmasi via WhatsApp</a>
    <small class="muted">Total pesanan: <b>${rupiah(O.total)}</b>${unpriced ? " + komponen request" : ""}</small>
  </div>`;
}

function render() {
  const lunas = O.bayar_status === "lunas";
  $("#confirmTitle").textContent = O.id ? `Pesanan #TSR-${O.id} Berhasil Dibuat` : "Pesanan Siap Dikonfirmasi";
  $("#confirmSub").textContent = lunas ? "Pembayaran sudah kami terima." : isPoketo() ? "Satu langkah lagi: selesaikan pembayaran." : "Satu langkah lagi: konfirmasi pesanan ke admin lewat WhatsApp.";
  $("#confirmPage").innerHTML = `
    <div class="confirm-grid">
      <div>${actionBox()}</div>
      <div class="track-card">
        <div class="track-head"><div><span class="muted">Nomor pesanan</span><h2>${O.id ? `#TSR-${O.id}` : "—"}</h2></div>
          <div class="track-badges"><span class="pay-badge ${lunas ? "paid" : ""}">${lunas ? "✓ Lunas" : "Belum dibayar"}</span></div></div>
        ${itemsTable(O)}
        <div class="track-grid">
          <div><h4>Pengiriman</h4><p><b>${esc(O.nama)}</b><br>${esc(O.hp)}<br>${esc(O.alamat)}</p>
            ${O.lokasi_lat != null ? `<a class="link" target="_blank" rel="noopener" href="${gmaps(O)}">📍 Lihat titik lokasi</a>` : ""}</div>
          <div><h4>Pembayaran</h4><p>${esc(O.pembayaran)}</p>${O.catatan ? `<h4>Catatan</h4><p class="muted">${esc(O.catatan)}</p>` : ""}</div>
        </div>
        ${O.id ? `<div class="track-actions">
          <a class="btn btn-ghost sm" href="lacak.html?id=${O.id}&hp=${encodeURIComponent(HP)}">🔎 Lacak Pesanan</a>
          <a class="btn btn-ghost sm" target="_blank" href="invoice.html?id=${O.id}&hp=${encodeURIComponent(HP)}">🧾 Invoice</a>
          <a class="btn btn-ghost sm" href="index.html#produk">Belanja Lagi</a></div>` : `<a class="btn btn-ghost sm" href="index.html#produk">Belanja Lagi</a>`}
      </div>
    </div>`;
  $("#payBtn")?.addEventListener("click", startPay);
}

async function startPay() {
  const btn = $("#payBtn"), err = $("#payErr");
  btn.disabled = true; btn.textContent = "Menyiapkan pembayaran..."; err.hidden = true;
  try {
    await Pay.open(O.id, HP, async status => {
      if (status === "paid") toast("Pembayaran diterima, memperbarui status...");
      await new Promise(r => setTimeout(r, status === "paid" ? 2500 : 300));
      await refresh();
    });
  } catch (e) {
    err.innerHTML = `${esc(e.message)}<br>Kamu tetap bisa <a class="link" target="_blank" href="${waLink()}">konfirmasi via WhatsApp</a>.`;
    err.hidden = false;
  }
  if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = "💳 Bayar Sekarang via Poketo"; }
}

async function refresh() {
  if (!db || !O?.id || !HP) return render();
  const { data } = await db.rpc("track_order", { p_id: O.id, p_hp: HP });
  if (data) O = { ...O, ...data };
  render();
}

(async () => {
  await loadSettings();
  const q = new URLSearchParams(location.search);
  const id = parseOrderId(q.get("id"));
  HP = q.get("hp") || "";
  const saved = JSON.parse(sessionStorage.getItem("tasura_last_order") || "null");
  if (saved && (!id || saved.order.id === id)) { O = saved.order; M = saved.method; WA = saved.wa; HP = HP || saved.order.hp; }
  if (id && HP && db) {
    const { data } = await db.rpc("track_order", { p_id: id, p_hp: HP });
    if (data) O = { ...(O || {}), ...data };
  }
  if (!O) {
    $("#confirmTitle").textContent = "Pesanan tidak ditemukan";
    $("#confirmSub").textContent = "";
    $("#confirmPage").innerHTML = `<div class="empty-page"><p class="muted">Cek pesananmu lewat halaman Lacak Pesanan dengan nomor pesanan dan nomor WhatsApp.</p><a class="btn btn-primary" href="lacak.html">Lacak Pesanan</a></div>`;
    return;
  }
  if (q.has("hp")) history.replaceState(null, "", location.pathname + (O.id ? `?id=${O.id}` : ""));
  render();
})();
