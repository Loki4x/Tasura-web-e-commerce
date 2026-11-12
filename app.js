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
// Poketo aktif: QRIS, Virtual Account, Akulaku PayLater, Kartu Debit (biaya layanan dibayar pembeli).
// Poketo belum aktif: transfer/e-wallet manual yang dikonfirmasi lewat WhatsApp.
const MANUAL_METHODS = [
  { code: "TRANSFER", name: "Transfer Bank", icon: "🏦", desc: "Nomor rekening dikirim admin lewat WhatsApp" },
  { code: "EWALLET", name: "E-Wallet (OVO/DANA/GoPay)", icon: "📱", desc: "Nomor e-wallet dikirim admin lewat WhatsApp" },
];
let payMethods = [], payPick = null, payRenderId = 0;
const onlinePay = () => useDb && typeof Pay !== "undefined" && Pay.enabled;
const payAmount = () => cartTotal() - (promoState.diskon || 0);
async function renderPayList() {
  const id = ++payRenderId, amount = payAmount(), online = onlinePay();
  const list = online ? await Pay.methods(amount) : MANUAL_METHODS;
  if (id !== payRenderId) return; // ada render yang lebih baru
  payMethods = list.map(m => {
    const tooLow = online && m.min && amount < m.min, tooHigh = online && m.max && amount > m.max;
    return { ...m, online, disabled: online && (!m.available || tooLow || tooHigh),
      reason: tooHigh ? `Maks. ${rupiah(m.max)} per transaksi` : tooLow ? `Min. ${rupiah(m.min)}` : !m.available && online ? "Sedang tidak tersedia" : "" };
  });
  if (!payPick || !payMethods.some(m => m.code === payPick && !m.disabled)) payPick = payMethods.find(m => !m.disabled)?.code || null;
  $("#payList").innerHTML = payMethods.map(m => `
    <label class="pay-opt ${m.disabled ? "off" : ""}">
      <input type="radio" name="bayar" value="${esc(m.online ? m.name + " (Poketo)" : m.name)}" data-code="${m.code}" ${m.code === payPick ? "checked" : ""} ${m.disabled ? "disabled" : ""} />
      <span class="pay-ico">${esc(m.icon || "💠")}</span>
      <span class="pay-txt"><b>${esc(m.name)}</b><small>${esc(m.reason || m.desc || "")}</small></span>
      ${m.online && !m.disabled && amount > 0 ? `<span class="pay-fee">${m.estimated ? "±" : "+"}${rupiah(m.fee)}<small>biaya layanan</small></span>` : ""}
    </label>`).join("");
  updatePayHint();
}
function updatePayHint() {
  const m = payMethods.find(x => x.code === payPick), req = requestCount() > 0;
  const showFee = m?.online && !req && payAmount() > 0;
  $("#feeRow").hidden = $("#payTotalRow").hidden = !showFee;
  if (showFee) {
    $("#feeLabel").textContent = `Biaya layanan ${m.name}${m.estimated ? " (perkiraan)" : ""}`;
    $("#feeVal").textContent = "+" + rupiah(m.fee);
    $("#payTotal").textContent = rupiah(m.totalAmount);
  }
  $("#payHint").hidden = !m?.online;
  $("#payHint").textContent = !m?.online ? "" : req
    ? "Keranjang berisi komponen request: pesanan dikirim ke WhatsApp dulu. Setelah admin mengonfirmasi harganya, bayar online dari halaman Lacak Pesanan."
    : `Setelah pesanan dibuat, halaman pembayaran Poketo terbuka. Pilih ${m.name} di sana — status lunas diperbarui otomatis.`;
  $("#checkoutForm button[type=submit]").textContent = m?.online && !req ? `Buat Pesanan & Bayar` : "Pesan via WhatsApp";
}
$("#payList").addEventListener("change", e => { if (e.target.name === "bayar") { payPick = e.target.dataset.code; updatePayHint(); } });
const syncPayOption = renderPayList;

function waMessage(o, f) {
  const items = o.items.map((i, n) => i.custom
    ? `${n + 1}. *[REQUEST]* ${i.slot ? i.slot + ": " : ""}${i.nama} x${i.qty} = harga menyusul (mohon dicarikan)`
    : `${n + 1}. ${i.nama} x${i.qty} = ${rupiah(i.harga * i.qty)}`).join("\n");
  const nReq = o.items.filter(i => i.custom).length;
  return `Halo *${STORE.nama}*, saya mau pesan${o.id ? ` (No. Pesanan *#TSR-${o.id}*)` : ""}:\n\n${items}\n\nSubtotal: ${rupiah(o.subtotal)}` +
    (o.diskon ? `\nDiskon (${o.promo}): -${rupiah(o.diskon)}` : "") +
    `\n*${nReq ? "Total sementara" : "Total"}: ${rupiah(o.total)}*` + (nReq ? ` + ${nReq} komponen request (harga menyusul)` : "") +
    `\n\n*Data Pengiriman*\nNama: ${f.nama}\nNo. HP: ${f.hp}\nAlamat: ${f.alamat}\nPembayaran: ${f.bayar}` +
    (o.id ? `\nLacak pesanan: ${location.origin}${location.pathname.replace(/[^/]*$/, "")}lacak.html?id=${o.id}` : "") +
    (lokasi ? `\nTitik lokasi: ${MapPicker.gmaps(lokasi)}` : "") +
    (f.catatan?.trim() ? `\nCatatan: ${f.catatan.trim()}` : "") + `\n\nTerima kasih 🙏`;
}

$("#checkoutForm").onsubmit = async e => {
  e.preventDefault();
  const form = e.target, btn = form.querySelector("button[type=submit]");
  const f = Object.fromEntries(new FormData(form));
  const err = $("#checkoutError"); err.hidden = true;
  if (!f.bayar) { const err0 = $("#checkoutError"); err0.textContent = "Pilih metode pembayaran."; err0.hidden = false; return; }
  const online = !!payMethods.find(m => m.code === payPick)?.online && useDb && requestCount() === 0;
  // Buka tab WhatsApp lebih dulu agar tidak diblokir popup blocker, lalu isi alamatnya setelah pesanan tersimpan.
  const waTab = online ? null : window.open("", "_blank");
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
    const url = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(waMessage(order, f))}`;
    if (online) {
      const track = `lacak.html?id=${order.id}&hp=${encodeURIComponent(f.hp)}`;
      cart = []; saveCart(); localStorage.removeItem("tasura_checkout_note");
      $("#checkoutModal").classList.remove("show");
      toast(`Pesanan #TSR-${order.id} dibuat, membuka pembayaran...`);
      try { await Pay.open(order.id, f.hp, () => { location.href = track; }); }
      catch (ex) { alert(`Pesanan #TSR-${order.id} sudah dibuat, tetapi halaman pembayaran gagal dibuka: ${ex.message}\nKamu bisa membayar dari halaman Lacak Pesanan atau menghubungi admin.`); location.href = track; }
      return;
    }
    if (waTab) waTab.location.href = url; else location.href = url;
    cart = []; saveCart(); form.reset(); promoState = { kode: "", diskon: 0, valid: false };
    localStorage.removeItem("tasura_checkout_note");
    MapPicker.clear(); $("#locPanel").hidden = true; $("#locToggle").textContent = "Pilih di Peta";
    $("#checkoutModal").classList.remove("show");
    toast(order.id ? `Pesanan #TSR-${order.id} dibuat 🎉` : "Pesanan dikirim ke WhatsApp 🎉");
    if (useDb) loadStore(); // perbarui stok
  } catch (ex) {
    waTab?.close();
    err.textContent = ex.message.replace(/^.*?ERROR:\s*/, "");
    err.hidden = false;
  } finally {
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

// ====== Hero slider ======
(() => {
  const slides = [...document.querySelectorAll(".slide")];
  let i = 0, timer;
  $("#dots").innerHTML = slides.map((_, n) => `<button aria-label="Slide ${n + 1}"></button>`).join("");
  const dots = [...document.querySelectorAll("#dots button")];
  const go = n => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle("active", k === i));
    dots.forEach((d, k) => d.classList.toggle("active", k === i));
    clearInterval(timer); timer = setInterval(() => go(i + 1), 6000);
  };
  dots.forEach((d, n) => d.onclick = () => go(n));
  $("#slidePrev").onclick = () => go(i - 1);
  $("#slideNext").onclick = () => go(i + 1);
  go(0);
})();

// ====== Marquee (diulang agar berjalan tanpa putus) ======
$("#marquee").innerHTML += $("#marquee").innerHTML;

// ====== FAQ: hanya satu terbuka ======
document.querySelectorAll("#faqList details").forEach(d => d.addEventListener("toggle", () => {
  if (d.open) document.querySelectorAll("#faqList details").forEach(o => o !== d && (o.open = false));
}));

// ====== Announcement bar ======
if (sessionStorage.getItem("tasura_announce_closed")) $("#announce").hidden = true;
$("#announceClose").onclick = () => { $("#announce").hidden = true; sessionStorage.setItem("tasura_announce_closed", "1"); };
$("#announceCta").onclick = e => { e.preventDefault(); Auth.openAuth(Auth.loggedIn ? "login" : "register"); };
$("#year").textContent = new Date().getFullYear();
const renderAll = () => { renderCategories(); renderProducts(); renderCart(); renderPopular(); renderNavCategories(); };

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
if (db) { $("#productGrid").innerHTML = `<p class="empty">Memuat produk...</p>`; $("#popularGrid").innerHTML = ""; }
else renderAll();
loadStore().then(() => {
  // Dibuka dari halaman Rakit PC: langsung tampilkan keranjang
  const cat = sessionStorage.getItem("tasura_cat");
  if (cat) { sessionStorage.removeItem("tasura_cat"); activeCat = cat; renderCategories(); renderProducts(); }
  if (new URLSearchParams(location.search).has("keranjang")) { history.replaceState(null, "", location.pathname); openCart(); }
});
