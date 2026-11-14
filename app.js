const $ = s => document.querySelector(s);
let cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
let activeCat = "Semua", query = "", sort = "default";

const thumbHTML = p => p.gambar ? `<img src="${esc(p.gambar)}" alt="${esc(p.nama)}" loading="lazy">` : esc(p.emoji);
const findP = id => PRODUCTS.find(p => p.id === id);
const habis = p => p.stok !== undefined && p.stok <= 0;
const stokInfo = p => p.stok === undefined ? "" : habis(p) ? `<span class="stock out">Stok habis</span>` : p.stok <= 5 ? `<span class="stock low">Sisa ${p.stok}</span>` : "";
const discPct = p => p.hargaCoret > p.harga ? Math.round((1 - p.harga / p.hargaCoret) * 100) : 0;

function renderCategories() {
  const cats = ["Semua", ...new Set(PRODUCTS.map(p => p.kategori))];
  $("#categories").innerHTML = cats.map(c =>
    `<button class="chip ${c === activeCat ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

function renderProducts() {
  let list = PRODUCTS.filter(p =>
    (activeCat === "Semua" || p.kategori === activeCat) &&
    [p.nama, p.kategori, ...(p.spek || [])].join(" ").toLowerCase().includes(query.toLowerCase()));
  if (sort === "low") list.sort((a, b) => a.harga - b.harga);
  if (sort === "high") list.sort((a, b) => b.harga - a.harga);
  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  $("#emptyState").hidden = list.length > 0;
  $("#productGrid").innerHTML = list.map(p => `
    <article class="card ${habis(p) ? "soldout" : ""}">
      <div class="thumb" data-detail="${p.id}">${discPct(p) ? `<span class="disc">-${discPct(p)}%</span>` : ""}${thumbHTML(p)}</div>
      <div class="card-body">
        <span class="cat">${esc(p.kategori)}</span>
        <h3 data-detail="${p.id}">${esc(p.nama)}</h3>
        <span class="meta">⭐ ${p.rating} • ${p.terjual} terjual ${stokInfo(p)}</span>
        <div class="price"><b>${rupiah(p.harga)}</b>${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}</div>
        <button class="btn btn-primary add" data-add="${p.id}" ${habis(p) ? "disabled" : ""}>${habis(p) ? "Stok Habis" : "+ Keranjang"}</button>
        <button class="cmp-btn ${typeof Compare !== "undefined" && Compare.has(p.id) ? "on" : ""}" data-cmp="${p.id}">${typeof Compare !== "undefined" && Compare.has(p.id) ? "✓ Dibandingkan" : "⇄ Bandingkan"}</button>
      </div>
    </article>`).join("");
}

// Halaman produk sendiri (link bisa dibagikan & diindeks Google)
const productUrl = p => `produk.html?id=${p.id}-${String(p.nama).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
function showDetail(id) {
  const p = findP(id);
  if (!p) return;
  location.href = productUrl(p); return;
  $("#detailBox").innerHTML = `
    <div class="thumb">${discPct(p) ? `<span class="disc">-${discPct(p)}%</span>` : ""}${thumbHTML(p)}</div>
    <div class="detail-body">
      <button class="icon-btn close" data-close>✕</button>
      <span class="cat">${esc(p.kategori)}</span>
      <h2 style="font-size:1.5rem">${esc(p.nama)}</h2>
      <span class="meta">⭐ ${p.rating} • ${p.terjual} terjual ${p.stok !== undefined && !habis(p) ? `• Stok ${p.stok}` : ""} ${stokInfo(p)}</span>
      <div class="price"><b style="font-size:1.5rem">${rupiah(p.harga)}</b>${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}</div>
      <p>${esc(p.deskripsi)}</p>
      ${p.spek?.length ? `<div class="spec"><b>Spesifikasi</b><ul>${p.spek.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      <button class="btn btn-primary" data-add="${p.id}" ${habis(p) ? "disabled" : ""}>${habis(p) ? "Stok Habis" : "+ Tambah ke Keranjang"}</button>
      <a class="btn btn-wa" target="_blank" href="https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(`Halo ${STORE.nama}, saya tertarik dengan produk *${p.nama}* (${rupiah(p.harga)}). Apakah masih tersedia?`)}">Tanya via WhatsApp</a>
    </div>`;
  $("#detailModal").classList.add("show");
}

function saveCart() { localStorage.setItem("tasura_cart", JSON.stringify(cart)); renderCart(); }
function addToCart(id) {
  const p = findP(id); if (!p) return;
  const item = cart.find(i => !i.custom && i.id === id);
  if (p.stok !== undefined && (item?.qty || 0) + 1 > p.stok) return toast(habis(p) ? "Stok habis" : `Stok tersisa ${p.stok}`);
  item ? item.qty++ : cart.push({ id, qty: 1 });
  saveCart();
  toast("✓ Ditambahkan ke keranjang");
}
const cartTotal = () => cart.reduce((s, i) => s + (i.custom ? 0 : (findP(i.id)?.harga || 0) * i.qty), 0);
const cartKey = i => i.custom ? i.key : String(i.id);
const requestCount = () => cart.filter(i => i.custom).length;

function renderCart() {
  cart = cart.filter(i => i.custom || findP(i.id)); // buang produk yang sudah tidak dijual
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
  $("#cartTotal").textContent = rupiah(cartTotal()) + (requestCount() ? ` + ${requestCount()} request` : "");
  if (!cart.length) { $("#cartItems").innerHTML = `<div class="cart-empty">🛒<br/>Keranjangmu masih kosong</div>`; return; }
  $("#cartItems").innerHTML = cart.map(i => {
    const k = esc(cartKey(i));
    if (i.custom) return `<div class="ci is-req">
      <div class="ci-thumb">🛠️</div>
      <div class="ci-info"><h4><span class="req-tag">Request</span> ${esc(i.slot ? i.slot + ": " : "")}${esc(i.nama)}</h4><b class="tbd">Harga menyusul</b>
        <div class="qty"><button data-dec="${k}">−</button>${i.qty}<button data-inc="${k}">+</button></div>
      </div>
      <button class="remove" data-rm="${k}">Hapus</button>
    </div>`;
    const p = findP(i.id);
    return `<div class="ci">
      <div class="ci-thumb">${thumbHTML(p)}</div>
      <div class="ci-info"><h4>${esc(p.nama)}</h4><b>${rupiah(p.harga)}</b>
        <div class="qty"><button data-dec="${k}">−</button>${i.qty}<button data-inc="${k}">+</button></div>
      </div>
      <button class="remove" data-rm="${k}">Hapus</button>
    </div>`;
  }).join("");
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 1800);
}
const openCart = () => { $("#cartDrawer").classList.add("open"); $("#overlay").classList.add("show"); };
const closeCart = () => { $("#cartDrawer").classList.remove("open"); $("#overlay").classList.remove("show"); };

// ====== Kode promo ======
// Dengan Supabase: dicek ke server (check_coupon). Tanpa Supabase: pakai STORE.promo di products.js.
let promoState = { kode: "", diskon: 0, valid: false };
let useDb = false; // true jika produk berhasil dimuat dari Supabase (002_admin.sql sudah dijalankan)
let promoTimer;
async function checkPromo(kode) {
  kode = kode.trim().toUpperCase();
  const sub = cartTotal();
  if (!kode) promoState = { kode: "", diskon: 0, valid: false, pesan: "" };
  else if (useDb) {
    const { data, error } = await db.rpc("check_coupon", { p_kode: kode, p_subtotal: sub });
    promoState = error ? { kode, diskon: 0, valid: false, pesan: "Gagal mengecek kode promo" }
      : { kode, diskon: data.valid ? data.diskon : 0, valid: data.valid, pesan: data.valid ? `Kode ${data.kode} dipakai ✓` : data.pesan };
  } else {
    const ok = kode === STORE.promo.kode;
    promoState = { kode, diskon: ok ? Math.round(sub * STORE.promo.diskon) : 0, valid: ok, pesan: ok ? `Kode ${kode} dipakai ✓` : "Kode promo tidak ditemukan" };
  }
  renderSummary();
  renderPayList();
}
function renderSummary() {
  const sub = cartTotal();
  $("#modalSubtotal").textContent = rupiah(sub);
  $("#discountRow").hidden = !promoState.diskon;
  $("#modalDiscount").textContent = "-" + rupiah(promoState.diskon);
  $("#modalTotal").textContent = rupiah(sub - promoState.diskon);
  const n = requestCount();
  $("#requestNote").hidden = !n;
  $("#requestNote").textContent = `+ ${n} komponen request (harga menyusul, dikonfirmasi admin via WhatsApp)`;
  const m = $("#promoMsg");
  m.hidden = !promoState.pesan;
  m.textContent = promoState.pesan || "";
  m.className = "promo-msg " + (promoState.valid ? "ok" : "bad");
}

// ====== Events ======
document.addEventListener("click", e => {
  const cmp = e.target.closest("[data-cmp]");
  if (cmp) { if (Compare.toggle(+cmp.dataset.cmp) === "full") toast(`Maksimal ${Compare.MAX} produk untuk dibandingkan`); renderProducts(); return; }
}, true);
document.addEventListener("click", e => {
  const t = e.target.closest("[data-add],[data-detail],[data-inc],[data-dec],[data-rm],[data-cat],[data-close]");
  if (!t) return;
  const d = t.dataset;
  if (d.add) addToCart(+d.add);
  else if (d.detail) showDetail(+d.detail);
  else if (d.cat) { activeCat = d.cat; renderCategories(); renderProducts(); }
  else if (d.close !== undefined) $("#detailModal").classList.remove("show");
  else {
    const k = d.inc || d.dec || d.rm, item = cart.find(i => cartKey(i) === k);
    if (!item) return;
    if (d.inc) {
      const p = !item.custom && findP(item.id);
      if (p && p.stok !== undefined && item.qty + 1 > p.stok) return toast(`Stok tersisa ${p.stok}`);
      item.qty++;
    }
    if (d.dec) item.qty--;
    if (d.rm || item.qty < 1) cart = cart.filter(i => i !== item);
    saveCart();
  }
});
$("#searchInput").addEventListener("input", e => { query = e.target.value; renderProducts(); });
$("#searchInput").addEventListener("keydown", e => { if (e.key === "Enter") $("#produk").scrollIntoView({ behavior: "smooth" }); });
$("#sortSelect").addEventListener("change", e => { sort = e.target.value; renderProducts(); });
$("#cartBtn").onclick = openCart;
$("#closeCart").onclick = closeCart;
$("#overlay").onclick = closeCart;
$("#menuBtn").onclick = () => $("#nav").classList.toggle("open");
document.querySelectorAll("#nav a").forEach(a => a.onclick = () => $("#nav").classList.remove("open"));

$("#checkoutBtn").onclick = () => {
  if (!cart.length) return toast("Keranjang masih kosong");
  closeCart();
  $("#loginHint").hidden = Auth.loggedIn;
  $("#checkoutError").hidden = true;
  Auth.prefill($("#checkoutForm"));
  const note = localStorage.getItem("tasura_checkout_note");
  if (note && !$("#checkoutForm").catatan.value) $("#checkoutForm").catatan.value = note;
  checkPromo($("#checkoutForm").promo.value);
  $("#checkoutModal").classList.add("show");
};
$("#closeModal").onclick = () => $("#checkoutModal").classList.remove("show");
["#checkoutModal", "#detailModal"].forEach(id =>
  $(id).addEventListener("click", e => { if (e.target.id === id.slice(1)) e.target.classList.remove("show"); }));
$("#checkoutForm").promo.addEventListener("input", e => {
  clearTimeout(promoTimer);
  promoTimer = setTimeout(() => checkPromo(e.target.value), 450);
});

// ====== Metode pembayaran ======
// Dua pilihan:
//  • Pembayaran Otomatis (Poketo): QRIS, Virtual Account, Akulaku PayLater, Kartu Debit — metode dipilih di halaman Poketo
//  • Pembayaran Manual via Admin (WhatsApp): QRIS, Transfer Bank, E-Wallet — dikonfirmasi admin
const MANUAL_METHODS = [
  { code: "QRIS_M", name: "QRIS", icon: "▦", desc: "Kode QRIS dikirim admin lewat WhatsApp" },
  { code: "TRANSFER", name: "Transfer Bank", icon: "🏦", desc: "Nomor rekening dikirim admin lewat WhatsApp" },
  { code: "EWALLET", name: "E-Wallet (OVO/DANA/GoPay)", icon: "📱", desc: "Nomor e-wallet dikirim admin lewat WhatsApp" },
];
const AUTO_LABELS = { QRIS: "QRIS", VA: "Bank (Virtual Account)", AKULAKU: "Akulaku PayLater", CARD: "Kartu Debit" };
let payMethods = [], payPick = null, payRenderId = 0;
const onlinePay = () => useDb && typeof Pay !== "undefined" && Pay.enabled;
const payAmount = () => cartTotal() - (promoState.diskon || 0);
const pickedMethod = () => payMethods.find(m => m.code === payPick);
const feeRange = m => m.feeMin === m.feeMax ? rupiah(m.feeMin) : `${rupiah(m.feeMin)} – ${rupiah(m.feeMax)}`;
async function renderPayList() {
  const id = ++payRenderId, amount = payAmount(), online = onlinePay();
  const list = online ? await Pay.methods(amount) : [];
  if (id !== payRenderId) return; // ada render yang lebih baru
  const subs = list.map(m => {
    const tooLow = m.min && amount < m.min, tooHigh = m.max && amount > m.max;
    return { ...m, off: !m.available || tooLow || tooHigh,
      reason: tooHigh ? `maks. ${rupiah(m.max)}` : tooLow ? `min. ${rupiah(m.min)}` : !m.available ? "tidak tersedia" : "" };
  });
  const ok = subs.filter(m => !m.off), fees = ok.map(m => m.fee);
  payMethods = [
    ...(online ? [{ code: "AUTO", name: "Pembayaran Otomatis", value: "Pembayaran Otomatis (Poketo)", icon: "⚡", online: true,
      disabled: !ok.length, estimated: ok.some(m => m.estimated), subs,
      feeMin: fees.length ? Math.min(...fees) : null, feeMax: fees.length ? Math.max(...fees) : null }] : []),
    ...MANUAL_METHODS.map(m => ({ ...m, value: m.name + " (via Admin)", online: false, disabled: false })),
  ];
  if (!payPick || !payMethods.some(m => m.code === payPick && !m.disabled)) payPick = payMethods.find(m => !m.disabled)?.code || null;
  const radio = m => `<input type="radio" name="bayar" value="${esc(m.value)}" data-code="${m.code}" ${m.code === payPick ? "checked" : ""} ${m.disabled ? "disabled" : ""} />`;
  const auto = payMethods.find(m => m.code === "AUTO");
  const autoHtml = auto ? `
    <label class="pay-opt pay-auto ${auto.disabled ? "off" : ""}">
      ${radio(auto)}
      <span class="pay-ico">⚡</span>
      <span class="pay-txt"><b>Pembayaran Otomatis</b><small>${auto.disabled ? "Sedang tidak tersedia untuk nominal ini" : "Bayar langsung via Poketo, status lunas otomatis"}</small></span>
      ${!auto.disabled && amount > 0 ? `<span class="pay-fee">${auto.estimated ? "±" : "+"}${feeRange(auto)}<small>biaya layanan</small></span>` : ""}
      <span class="pay-chips">${subs.map(m => `<span class="pay-chip ${m.off ? "off" : ""}" title="${m.off ? esc(m.reason) : "Biaya layanan " + rupiah(m.fee)}">${esc(m.icon || "")} ${esc(AUTO_LABELS[m.code] || m.name)}${m.off ? ` <i>(${esc(m.reason)})</i>` : ""}</span>`).join("")}</span>
    </label>` : "";
  const manualHtml = `
    <div class="pay-group pay-manual">
      <div class="pay-group-head"><b>💬 Pembayaran Manual via Admin</b><small>Konfirmasi pesanan ke admin lewat WhatsApp, lalu admin mengirim info pembayaran</small></div>
      ${payMethods.filter(m => !m.online).map(m => `
      <label class="pay-opt">
        ${radio(m)}
        <span class="pay-ico">${esc(m.icon)}</span>
        <span class="pay-txt"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></span>
      </label>`).join("")}
    </div>`;
  $("#payList").innerHTML = autoHtml + manualHtml;
  updatePayHint();
}
function updatePayHint() {
  const m = pickedMethod(), req = requestCount() > 0;
  const showFee = m?.online && !m.disabled && !req && payAmount() > 0;
  $("#feeRow").hidden = $("#payTotalRow").hidden = !showFee;
  if (showFee) {
    $("#feeLabel").textContent = `Biaya layanan Poketo${m.estimated ? " (perkiraan)" : ""}`;
    $("#feeVal").textContent = "+" + feeRange(m);
    const t = payAmount();
    $("#payTotal").textContent = m.feeMin === m.feeMax ? rupiah(t + m.feeMin) : `${rupiah(t + m.feeMin)} – ${rupiah(t + m.feeMax)}`;
  }
  $("#payHint").hidden = !(m?.online && req);
  $("#payHint").textContent = m?.online && req ? "Keranjang berisi komponen request: harga komponennya dicarikan admin dulu. Setelah harga dikonfirmasi, kamu bisa bayar via Poketo dari halaman Lacak Pesanan." : "";
  $("#checkoutForm button[type=submit]").textContent = "Konfirmasi Pesanan";
}
$("#payList").addEventListener("change", e => { if (e.target.name === "bayar") { payPick = e.target.dataset.code; updatePayHint(); } });
const syncPayOption = renderPayList;

function waMessage(o, f) {
  const items = o.items.map((i, n) => i.custom
    ? `${n + 1}. *[REQUEST]* ${i.slot ? i.slot + ": " : ""}${i.nama} x${i.qty} = harga menyusul (mohon dicarikan)`
    : `${n + 1}. ${i.nama} x${i.qty} = ${rupiah(i.harga * i.qty)}`).join("\n");
  const nReq = o.items.filter(i => i.custom).length;
  return `Halo *${STORE.nama}*, saya mau konfirmasi pesanan${o.id ? ` *#TSR-${o.id}*` : ""}:\n\n${items}\n\nSubtotal: ${rupiah(o.subtotal)}` +
    (o.diskon ? `\nDiskon (${o.promo}): -${rupiah(o.diskon)}` : "") +
    `\n*${nReq ? "Total sementara" : "Total"}: ${rupiah(o.total)}*` + (nReq ? ` + ${nReq} komponen request (harga menyusul)` : "") +
    `\n\n*Data Pengiriman*\nNama: ${f.nama}\nNo. HP: ${f.hp}\nAlamat: ${f.alamat}\nPembayaran: ${f.bayar}` +
    (o.id ? `\nLacak pesanan: ${location.origin}${location.pathname.replace(/[^/]*$/, "")}lacak.html?id=${o.id}` : "") +
    (lokasi ? `\nTitik lokasi: ${MapPicker.gmaps(lokasi)}` : "") +
    (f.catatan?.trim() ? `\nCatatan: ${f.catatan.trim()}` : "") + `\n\nMohon info pembayarannya ya, terima kasih 🙏`;
}

// Buat pesanan, lalu lanjut ke halaman Konfirmasi Pesanan (bayar via Poketo atau konfirmasi via WhatsApp)
$("#checkoutForm").onsubmit = async e => {
  e.preventDefault();
  const form = e.target, btn = form.querySelector("button[type=submit]");
  const f = Object.fromEntries(new FormData(form));
  const err = $("#checkoutError"); err.hidden = true;
  const m = pickedMethod();
  if (!f.bayar || !m) { err.textContent = "Pilih metode pembayaran."; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = "Memproses pesanan...";
  try {
    let order;
    if (useDb) {
      const args = {
        p_items: cart.map(i => i.custom ? { custom: true, slot: i.slot, nama: i.nama, qty: i.qty } : { id: i.id, qty: i.qty }), p_nama: f.nama, p_hp: f.hp, p_alamat: f.alamat,
        p_pembayaran: f.bayar, p_promo: f.promo || null, p_catatan: f.catatan || null,
      };
      let { data, error } = await db.rpc("place_order", lokasi ? { ...args, p_lat: lokasi.lat, p_lng: lokasi.lng } : args);
      if (error && lokasi && (error.code === "PGRST202" || /function/i.test(error.message))) {
        // database belum diperbarui (005): simpan titik lokasi di catatan
        ({ data, error } = await db.rpc("place_order", { ...args, p_catatan: [f.catatan, `Titik lokasi: ${MapPicker.gmaps(lokasi)}`].filter(Boolean).join(" | ").slice(0, 500) }));
      }
      if (error) throw new Error(requestCount() && /tidak tersedia/.test(error.message)
        ? "Komponen request belum bisa diproses (database belum diperbarui). Silakan pesan lewat tombol Konsultasi WhatsApp di halaman Rakit PC."
        : error.message);
      order = data;
      Auth.saveProfile(f);
    } else {
      const sub = cartTotal();
      order = { items: cart.map(i => i.custom ? { ...i, harga: 0 } : { ...findP(i.id), qty: i.qty }), subtotal: sub, diskon: promoState.diskon, promo: promoState.kode, total: sub - promoState.diskon };
    }
    // Data untuk halaman konfirmasi (juga dipakai bila database belum tersambung)
    sessionStorage.setItem("tasura_last_order", JSON.stringify({
      order: { ...order, nama: f.nama, hp: f.hp, alamat: f.alamat, pembayaran: f.bayar, catatan: f.catatan || "", created_at: new Date().toISOString(),
        lokasi_lat: lokasi?.lat ?? null, lokasi_lng: lokasi?.lng ?? null },
      method: { code: m.code, name: m.name, online: !!m.online && useDb, feeMin: m.feeMin ?? null, feeMax: m.feeMax ?? null, estimated: !!m.estimated },
      wa: waMessage(order, f),
    }));
    cart = []; saveCart(); localStorage.removeItem("tasura_checkout_note");
    location.href = order.id ? `konfirmasi.html?id=${order.id}&hp=${encodeURIComponent(f.hp)}` : "konfirmasi.html";
  } catch (ex) {
    err.textContent = ex.message.replace(/^.*?ERROR:\s*/, "");
    err.hidden = false;
    btn.disabled = false; updatePayHint();
  }
};

// ====== Titik lokasi pengiriman ======
let lokasi = null;
function renderLoc(v) {
  lokasi = v;
  const ta = $("#checkoutForm").alamat;
  // Isi otomatis jika kolom kosong atau isinya masih hasil peta sebelumnya (tidak menimpa ketikan pembeli)
  if (v?.alamat && (!ta.value.trim() || ta.value === ta.dataset.auto)) {
    ta.value = v.alamat; ta.dataset.auto = v.alamat;
    ta.classList.remove("flash"); void ta.offsetWidth; ta.classList.add("flash");
  }
  const box = $("#locInfo");
  box.hidden = !v;
  if (!v) return;
  box.innerHTML = `<b>📍 Titik dipilih</b> <span class="muted">${v.lat}, ${v.lng}</span>
    ${v.alamat ? `<div class="loc-addr">${esc(v.alamat)}</div>` : `<div class="loc-addr">Mencari alamat...</div>`}
    ${v.alamat && $("#checkoutForm").alamat.value === v.alamat ? `<div class="loc-tip">✓ Alamat lengkap diisi dari peta. Tambahkan nomor rumah, RT/RW, atau patokan bila perlu.</div>` : ""}
    <div class="loc-actions"><a href="${MapPicker.gmaps(v)}" target="_blank" rel="noopener" class="link">Cek di Google Maps</a>
    ${v.alamat && ta.value !== v.alamat ? `<button type="button" class="link" id="locFill">Ganti alamat dengan hasil peta</button>` : ""}
    <button type="button" class="link danger" id="locClear">Hapus titik</button></div>`;
}
const locErr = m => { $("#locError").textContent = m || ""; $("#locError").hidden = !m; };
$("#locToggle").onclick = async () => {
  const panel = $("#locPanel");
  panel.hidden = !panel.hidden;
  $("#locToggle").textContent = panel.hidden ? "Pilih di Peta" : "Tutup Peta";
  if (!panel.hidden) {
    locErr("");
    try { await MapPicker.mount($("#locMap"), lokasi, renderLoc); } catch (e) { locErr(e.message); }
  }
};
const doLocSearch = async () => {
  const q = $("#locSearch").value.trim(); if (!q) return;
  locErr(""); try { await MapPicker.search(q); } catch (e) { locErr(e.message || "Pencarian gagal"); }
};
$("#locSearchBtn").onclick = doLocSearch;
$("#locSearch").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); doLocSearch(); } });
$("#locMe").onclick = async () => { locErr(""); try { await MapPicker.myLocation(); } catch (e) { locErr(e.message); } };
$("#locInfo").addEventListener("click", e => {
  if (e.target.id === "locClear") MapPicker.clear();
  if (e.target.id === "locFill") { const ta = $("#checkoutForm").alamat; ta.value = ta.dataset.auto = lokasi.alamat; renderLoc(lokasi); }
});

$("#loginFromCheckout").onclick = e => { e.preventDefault(); $("#checkoutModal").classList.remove("show"); Auth.openAuth(); };
const setWaLinks = () => document.querySelectorAll(".waLink").forEach(a => { a.href = `https://wa.me/${STORE.whatsapp}`; a.target = "_blank"; });
setWaLinks();

// ====== Paling Populer (4 produk terlaris) ======
function renderPopular() {
  const top = PRODUCTS.filter(p => !habis(p)).sort((a, b) => b.terjual - a.terjual).slice(0, 4);
  $("#popularGrid").innerHTML = top.map(p => `
    <article class="pcard" data-detail="${p.id}">
      <div class="thumb">${discPct(p) ? `<span class="disc">-${discPct(p)}%</span>` : ""}${thumbHTML(p)}</div>
      <div class="pcard-body">
        <div class="rate"><b>⭐ ${p.rating}</b>Terlaris • ${p.terjual} terjual</div>
        <h3>${esc(p.nama)}</h3>
        <div class="plabel">Harga</div>
        <div class="pprice">${rupiah(p.harga)}${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}</div>
      </div>
    </article>`).join("");
}

// ====== Menu Koleksi (kategori) ======
function renderNavCategories() {
  const cats = ["Semua", ...new Set(PRODUCTS.map(p => p.kategori))];
  $("#navCategories").innerHTML = cats.map(c => `<a data-navcat="${esc(c)}">${c === "Semua" ? "Semua Produk" : esc(c)}</a>`).join("");
}
document.addEventListener("click", e => {
  const a = e.target.closest("[data-navcat]");
  if (a) {
    activeCat = a.dataset.navcat; renderCategories(); renderProducts();
    $("#nav").classList.remove("open"); document.querySelector(".dropdown").classList.remove("open");
    $("#produk").scrollIntoView({ behavior: "smooth" });
  }
});
document.querySelector(".dropdown-toggle").onclick = () => document.querySelector(".dropdown").classList.toggle("open");

// ====== Hero: panggung produk dengan bola cahaya ======
const HERO_TABS = {
  siap: p => ["PC Rakitan", "Monitor"].includes(p.kategori),
  komponen: p => ["Processor", "VGA", "RAM", "Storage", "Motherboard", "PSU", "Casing"].includes(p.kategori),
  aksesoris: p => !["PC Rakitan", "Monitor", "Processor", "VGA", "RAM", "Storage", "Motherboard", "PSU", "Casing"].includes(p.kategori),
};
let heroTab = "siap", heroSel = 0;
addEventListener("resize", () => { clearTimeout(renderHero.t); renderHero.t = setTimeout(renderHero, 150); });
function renderHero() {
  const list = PRODUCTS.filter(p => HERO_TABS[heroTab](p) && !habis(p)).sort((a, b) => b.terjual - a.terjual).slice(0, 5);
  if (!list.length) { $("#heroOrbs").innerHTML = ""; $("#heroCaps").innerHTML = ""; return; }
  heroSel = Math.min(heroSel, list.length - 1);
  // Urutkan agar produk terpilih berada di tengah; ukuran mengecil menjauhi tengah
  // Melingkar: produk lain tampil di kiri dan kanan produk terpilih
  const n = list.length, half = Math.floor(n / 2);
  const order = list.map((p, i) => ({ p, i, d: ((i - heroSel + n + half) % n) - half }));
  const mobile = innerWidth <= 768, gap = mobile ? 16 : 28;
  const size = d => (mobile ? [168, 100, 72, 56] : [256, 202, 145, 110])[Math.min(Math.abs(d), 3)];
  // Posisi horizontal dari tengah: setengah ukuran bola + jarak + bola berikutnya
  const pos = d => { let x = 0; for (let k = 1; k <= Math.abs(d); k++) x += size(k - 1) / 2 + gap + size(k) / 2; return Math.sign(d) * x; };
  const box = $("#heroOrbs"), key = heroTab + ":" + list.map(p => p.id).join(",") + ":" + mobile;
  // Bola dibuat sekali per tab; saat produk dipilih, bola yang sama digeser (animasi CSS)
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.innerHTML = list.map((p, i) => `
      <button type="button" class="orb orb-c${(p.id % 4) + 1}" data-orb="${i}" aria-label="${esc(p.nama)}">
        <span class="orb-grain"></span>
        <span class="orb-obj">${p.gambar ? `<img src="${esc(p.gambar)}" alt="">` : esc(p.emoji)}</span>
      </button>`).join("");
    box.classList.remove("enter"); void box.offsetWidth; box.classList.add("enter"); clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove("enter"), 700);
  }
  const els = [...box.children];
  order.forEach(({ p, i, d }) => {
    const el = els[i], prev = el.dataset.d === undefined ? null : +el.dataset.d;
    // Bola yang "memutar" dari ujung kiri ke kanan (atau sebaliknya) muncul memudar, tidak melintas
    const wrap = prev !== null && Math.abs(prev - d) > half;
    if (wrap) { el.style.transition = "none"; el.style.opacity = "0"; }
    el.style.setProperty("--s", size(d) + "px");
    el.style.setProperty("--px", pos(d) + "px");
    el.style.zIndex = 10 - Math.abs(d);
    el.classList.toggle("sel", d === 0);
    el.classList.toggle("far", Math.abs(d) >= 2);
    el.dataset.d = d;
    if (wrap) { void el.offsetWidth; el.style.transition = ""; el.style.opacity = ""; }
    el.querySelector(".orb-play")?.remove();
    if (d === 0) el.insertAdjacentHTML("beforeend", `<span class="orb-play" data-detail="${p.id}" aria-label="Lihat produk"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>`);
  });
  const sel = list[heroSel];
  $("#heroCaps").innerHTML = `
    <div class="caps-list">${list.map((p, i) => `<button type="button" data-orb="${i}" class="${i === heroSel ? "on" : ""}" aria-label="${esc(p.nama)}"></button>`).join("")}</div>
    <div class="caps-sel"><small>${esc(sel.kategori)}</small><b>${esc(sel.nama)}</b><span>${rupiah(sel.harga)}${sel.hargaCoret > sel.harga ? ` <s>${rupiah(sel.hargaCoret)}</s>` : ""}</span></div>`;
}
$("#heroTabs").addEventListener("click", e => {
  const b = e.target.closest("[data-hero]"); if (!b) return;
  heroTab = b.dataset.hero; heroSel = 0;
  document.querySelectorAll("#heroTabs button").forEach(x => x.classList.toggle("active", x === b));
  renderHero();
});
// Geser kiri/kanan di layar sentuh untuk pindah produk
(() => {
  const stage = document.querySelector(".hero-stage"); let x0 = null;
  const step = dir => { const n = $("#heroOrbs").children.length; if (n) { heroSel = (heroSel + dir + n) % n; renderHero(); } };
  stage.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("keydown", e => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); });
})();
document.querySelector(".hero-stage").addEventListener("click", e => {
  if (e.target.closest("[data-detail]")) return;
  const o = e.target.closest("[data-orb]"); if (!o) return;
  heroSel = +o.dataset.orb; renderHero();
});

// ====== FAQ: hanya satu terbuka ======
document.querySelectorAll("#faqList details").forEach(d => d.addEventListener("toggle", () => {
  if (d.open) document.querySelectorAll("#faqList details").forEach(o => o !== d && (o.open = false));
}));

// ====== Announcement bar ======
if (sessionStorage.getItem("tasura_announce_closed")) $("#announce").hidden = true;
$("#announceClose").onclick = () => { $("#announce").hidden = true; sessionStorage.setItem("tasura_announce_closed", "1"); };
$("#announceCta").onclick = e => { e.preventDefault(); Auth.openAuth(Auth.loggedIn ? "login" : "register"); };
$("#year").textContent = new Date().getFullYear();
const renderAll = () => { renderCategories(); renderProducts(); renderCart(); renderPopular(); renderNavCategories(); renderHero(); };

// ====== Muat produk & pengaturan dari Supabase ======
async function loadStore() {
  if (!db) return renderAll();
  const [prod, set] = await Promise.all([
    db.from("products").select("*").eq("aktif", true).order("urutan").order("id"),
    db.from("settings").select("key,value"),
  ]);
  if (prod.error) { console.warn("Gagal memuat produk dari Supabase, memakai data cadangan", prod.error); return renderAll(); }
  PRODUCTS = prod.data.map(fromDbProduct);
  useDb = true;
  if (typeof Pay !== "undefined") await Pay.init();
  const cfg = Object.fromEntries((set.data || []).map(r => [r.key, r.value]));
  if (cfg.whatsapp) { STORE.whatsapp = cfg.whatsapp; setWaLinks(); }
  if (cfg.pengumuman) $("#announceText").textContent = cfg.pengumuman;
  renderAll();
}
// Dibuka dari halaman lain: ?keranjang=1 (keranjang) atau ?checkout=1 (data pengiriman) langsung tampil
const startParams = new URLSearchParams(location.search);
const startWith = startParams.has("checkout") ? "checkout" : startParams.has("keranjang") ? "keranjang" : "";
if (startWith) {
  history.replaceState(null, "", location.pathname);
  if (startWith === "checkout") $("#checkoutModal").classList.add("show"); else openCart();
}
if (db) {
  $("#productGrid").innerHTML = `<p class="empty">Memuat produk...</p>`; $("#popularGrid").innerHTML = "";
  if (startWith === "keranjang") $("#cartItems").innerHTML = `<div class="cart-empty">Memuat keranjang...</div>`;
}
else renderAll();
loadStore().then(() => {
  const cat = sessionStorage.getItem("tasura_cat");
  if (cat) { sessionStorage.removeItem("tasura_cat"); activeCat = cat; renderCategories(); renderProducts(); }
  if (startWith === "checkout") { if (cart.length) $("#checkoutBtn").onclick(); else { $("#checkoutModal").classList.remove("show"); openCart(); } }
});
