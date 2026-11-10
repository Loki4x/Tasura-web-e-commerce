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
      </div>
    </article>`).join("");
}

function showDetail(id) {
  const p = findP(id);
  if (!p) return;
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
  const item = cart.find(i => i.id === id);
  if (p.stok !== undefined && (item?.qty || 0) + 1 > p.stok) return toast(habis(p) ? "Stok habis" : `Stok tersisa ${p.stok}`);
  item ? item.qty++ : cart.push({ id, qty: 1 });
  saveCart();
  toast("✓ Ditambahkan ke keranjang");
}
const cartTotal = () => cart.reduce((s, i) => s + (findP(i.id)?.harga || 0) * i.qty, 0);

function renderCart() {
  cart = cart.filter(i => findP(i.id)); // buang produk yang sudah tidak dijual
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
  $("#cartTotal").textContent = rupiah(cartTotal());
  if (!cart.length) { $("#cartItems").innerHTML = `<div class="cart-empty">🛒<br/>Keranjangmu masih kosong</div>`; return; }
  $("#cartItems").innerHTML = cart.map(i => {
    const p = findP(i.id);
    return `<div class="ci">
      <div class="ci-thumb">${thumbHTML(p)}</div>
      <div class="ci-info"><h4>${esc(p.nama)}</h4><b>${rupiah(p.harga)}</b>
        <div class="qty"><button data-dec="${p.id}">−</button>${i.qty}<button data-inc="${p.id}">+</button></div>
      </div>
      <button class="remove" data-rm="${p.id}">Hapus</button>
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
}
function renderSummary() {
  const sub = cartTotal();
  $("#modalSubtotal").textContent = rupiah(sub);
  $("#discountRow").hidden = !promoState.diskon;
  $("#modalDiscount").textContent = "-" + rupiah(promoState.diskon);
  $("#modalTotal").textContent = rupiah(sub - promoState.diskon);
  const m = $("#promoMsg");
  m.hidden = !promoState.pesan;
  m.textContent = promoState.pesan || "";
  m.className = "promo-msg " + (promoState.valid ? "ok" : "bad");
}

// ====== Events ======
document.addEventListener("click", e => {
  const t = e.target.closest("[data-add],[data-detail],[data-inc],[data-dec],[data-rm],[data-cat],[data-close]");
  if (!t) return;
  const d = t.dataset;
  if (d.add) addToCart(+d.add);
  else if (d.detail) showDetail(+d.detail);
  else if (d.cat) { activeCat = d.cat; renderCategories(); renderProducts(); }
  else if (d.close !== undefined) $("#detailModal").classList.remove("show");
  else {
    const id = +(d.inc || d.dec || d.rm), item = cart.find(i => i.id === id);
    if (d.inc) item.qty++;
    if (d.dec) item.qty--;
    if (d.rm || item.qty < 1) cart = cart.filter(i => i.id !== id);
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

function waMessage(o, f) {
  const items = o.items.map((i, n) => `${n + 1}. ${i.nama} x${i.qty} = ${rupiah(i.harga * i.qty)}`).join("\n");
  return `Halo *${STORE.nama}*, saya mau pesan${o.id ? ` (No. Pesanan *#TSR-${o.id}*)` : ""}:\n\n${items}\n\nSubtotal: ${rupiah(o.subtotal)}` +
    (o.diskon ? `\nDiskon (${o.promo}): -${rupiah(o.diskon)}` : "") +
    `\n*Total: ${rupiah(o.total)}*\n\n*Data Pengiriman*\nNama: ${f.nama}\nNo. HP: ${f.hp}\nAlamat: ${f.alamat}\nPembayaran: ${f.bayar}` +
    (f.catatan?.trim() ? `\nCatatan: ${f.catatan.trim()}` : "") + `\n\nTerima kasih 🙏`;
}

$("#checkoutForm").onsubmit = async e => {
  e.preventDefault();
  const form = e.target, btn = form.querySelector("button[type=submit]");
  const f = Object.fromEntries(new FormData(form));
  const err = $("#checkoutError"); err.hidden = true;
  // Buka tab WhatsApp lebih dulu agar tidak diblokir popup blocker, lalu isi alamatnya setelah pesanan tersimpan.
  const waTab = window.open("", "_blank");
  btn.disabled = true; btn.textContent = "Memproses pesanan...";
  try {
    let order;
    if (useDb) {
      const { data, error } = await db.rpc("place_order", {
        p_items: cart.map(i => ({ id: i.id, qty: i.qty })), p_nama: f.nama, p_hp: f.hp, p_alamat: f.alamat,
        p_pembayaran: f.bayar, p_promo: f.promo || null, p_catatan: f.catatan || null,
      });
      if (error) throw new Error(error.message);
      order = data;
      Auth.saveProfile(f);
    } else {
      const sub = cartTotal();
      order = { items: cart.map(i => ({ ...findP(i.id), qty: i.qty })), subtotal: sub, diskon: promoState.diskon, promo: promoState.kode, total: sub - promoState.diskon };
    }
    const url = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(waMessage(order, f))}`;
    if (waTab) waTab.location.href = url; else location.href = url;
    cart = []; saveCart(); form.reset(); promoState = { kode: "", diskon: 0, valid: false };
    $("#checkoutModal").classList.remove("show");
    toast(order.id ? `Pesanan #TSR-${order.id} dibuat 🎉` : "Pesanan dikirim ke WhatsApp 🎉");
    if (useDb) loadStore(); // perbarui stok
  } catch (ex) {
    waTab?.close();
    err.textContent = ex.message.replace(/^.*?ERROR:\s*/, "");
    err.hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "Pesan via WhatsApp";
  }
};

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
  const cfg = Object.fromEntries((set.data || []).map(r => [r.key, r.value]));
  if (cfg.whatsapp) { STORE.whatsapp = cfg.whatsapp; setWaLinks(); }
  if (cfg.pengumuman) $("#announceText").textContent = cfg.pengumuman;
  renderAll();
}
if (db) { $("#productGrid").innerHTML = `<p class="empty">Memuat produk...</p>`; $("#popularGrid").innerHTML = ""; }
else renderAll();
loadStore();
