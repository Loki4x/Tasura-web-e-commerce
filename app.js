const rupiah = n => "Rp" + n.toLocaleString("id-ID");
const $ = s => document.querySelector(s);
let cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
let activeCat = "Semua", query = "", sort = "default";

const thumbHTML = p => p.gambar ? `<img src="${p.gambar}" alt="${p.nama}" loading="lazy">` : p.emoji;
const discPct = p => p.hargaCoret > p.harga ? Math.round((1 - p.harga / p.hargaCoret) * 100) : 0;

function renderCategories() {
  const cats = ["Semua", ...new Set(PRODUCTS.map(p => p.kategori))];
  $("#categories").innerHTML = cats.map(c =>
    `<button class="chip ${c === activeCat ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
}

function renderProducts() {
  let list = PRODUCTS.filter(p =>
    (activeCat === "Semua" || p.kategori === activeCat) &&
    p.nama.toLowerCase().includes(query.toLowerCase()));
  if (sort === "low") list.sort((a, b) => a.harga - b.harga);
  if (sort === "high") list.sort((a, b) => b.harga - a.harga);
  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  $("#emptyState").hidden = list.length > 0;
  $("#productGrid").innerHTML = list.map(p => `
    <article class="card">
      <div class="thumb" data-detail="${p.id}">${discPct(p) ? `<span class="disc">-${discPct(p)}%</span>` : ""}${thumbHTML(p)}</div>
      <div class="card-body">
        <span class="cat">${p.kategori}</span>
        <h3 data-detail="${p.id}">${p.nama}</h3>
        <span class="meta">⭐ ${p.rating} • ${p.terjual} terjual</span>
        <div class="price"><b>${rupiah(p.harga)}</b>${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}</div>
        <button class="btn btn-primary add" data-add="${p.id}">+ Keranjang</button>
      </div>
    </article>`).join("");
}

function showDetail(id) {
  const p = PRODUCTS.find(x => x.id === id);
  $("#detailBox").innerHTML = `
    <div class="thumb">${discPct(p) ? `<span class="disc">-${discPct(p)}%</span>` : ""}${thumbHTML(p)}</div>
    <div class="detail-body">
      <button class="icon-btn close" data-close>✕</button>
      <span class="cat">${p.kategori}</span>
      <h2 style="font-size:1.5rem">${p.nama}</h2>
      <span class="meta">⭐ ${p.rating} • ${p.terjual} terjual</span>
      <div class="price"><b style="font-size:1.5rem">${rupiah(p.harga)}</b>${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}</div>
      <p>${p.deskripsi}</p>
      <button class="btn btn-primary" data-add="${p.id}">+ Tambah ke Keranjang</button>
      <a class="btn btn-wa" target="_blank" href="https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(`Halo ${STORE.nama}, saya tertarik dengan produk *${p.nama}* (${rupiah(p.harga)}). Apakah masih tersedia?`)}">Tanya via WhatsApp</a>
    </div>`;
  $("#detailModal").classList.add("show");
}

function saveCart() { localStorage.setItem("tasura_cart", JSON.stringify(cart)); renderCart(); }
function addToCart(id) {
  const item = cart.find(i => i.id === id);
  item ? item.qty++ : cart.push({ id, qty: 1 });
  saveCart();
  toast("✓ Ditambahkan ke keranjang");
}
const cartTotal = () => cart.reduce((s, i) => s + PRODUCTS.find(p => p.id === i.id).harga * i.qty, 0);

function renderCart() {
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
  $("#cartTotal").textContent = rupiah(cartTotal());
  if (!cart.length) { $("#cartItems").innerHTML = `<div class="cart-empty">🛒<br/>Keranjangmu masih kosong</div>`; return; }
  $("#cartItems").innerHTML = cart.map(i => {
    const p = PRODUCTS.find(x => x.id === i.id);
    return `<div class="ci">
      <div class="ci-thumb">${thumbHTML(p)}</div>
      <div class="ci-info"><h4>${p.nama}</h4><b>${rupiah(p.harga)}</b>
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

function finalTotal(promo) {
  const t = cartTotal();
  return promo.trim().toUpperCase() === STORE.promo.kode ? Math.round(t * (1 - STORE.promo.diskon)) : t;
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
$("#sortSelect").addEventListener("change", e => { sort = e.target.value; renderProducts(); });
$("#cartBtn").onclick = openCart;
$("#closeCart").onclick = closeCart;
$("#overlay").onclick = closeCart;
$("#menuBtn").onclick = () => $("#nav").classList.toggle("open");
document.querySelectorAll("#nav a").forEach(a => a.onclick = () => $("#nav").classList.remove("open"));

$("#checkoutBtn").onclick = () => {
  if (!cart.length) return toast("Keranjang masih kosong");
  closeCart();
  $("#modalTotal").textContent = rupiah(finalTotal(""));
  $("#loginHint").hidden = Auth.loggedIn;
  Auth.prefill($("#checkoutForm"));
  $("#checkoutModal").classList.add("show");
};
$("#closeModal").onclick = () => $("#checkoutModal").classList.remove("show");
["#checkoutModal", "#detailModal"].forEach(id =>
  $(id).addEventListener("click", e => { if (e.target.id === id.slice(1)) e.target.classList.remove("show"); }));
$("#checkoutForm").promo.addEventListener("input", e => $("#modalTotal").textContent = rupiah(finalTotal(e.target.value)));

$("#checkoutForm").onsubmit = e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const items = cart.map((i, n) => {
    const p = PRODUCTS.find(x => x.id === i.id);
    return `${n + 1}. ${p.nama} x${i.qty} = ${rupiah(p.harga * i.qty)}`;
  }).join("\n");
  const promoOk = f.promo.trim().toUpperCase() === STORE.promo.kode;
  const msg = `Halo *${STORE.nama}*, saya mau pesan:\n\n${items}\n\nSubtotal: ${rupiah(cartTotal())}` +
    (promoOk ? `\nPromo ${STORE.promo.kode}: -${STORE.promo.diskon * 100}%` : "") +
    `\n*Total: ${rupiah(finalTotal(f.promo))}*\n\n*Data Pengiriman*\nNama: ${f.nama}\nNo. HP: ${f.hp}\nAlamat: ${f.alamat}\nPembayaran: ${f.bayar}\n\nTerima kasih 🙏`;
  // Simpan ke riwayat pesanan jika sudah login (tidak menunggu agar WhatsApp tidak diblokir popup blocker)
  Auth.saveOrder({
    items: cart.map(i => { const p = PRODUCTS.find(x => x.id === i.id); return { id: p.id, nama: p.nama, harga: p.harga, qty: i.qty }; }),
    subtotal: cartTotal(), diskon: cartTotal() - finalTotal(f.promo), total: finalTotal(f.promo),
    promo: promoOk ? STORE.promo.kode : null,
    nama: f.nama, hp: f.hp, alamat: f.alamat, pembayaran: f.bayar,
  });
  window.open(`https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  cart = []; saveCart();
  e.target.reset();
  $("#checkoutModal").classList.remove("show");
  toast("Pesanan dikirim ke WhatsApp 🎉");
};

$("#loginFromCheckout").onclick = e => { e.preventDefault(); $("#checkoutModal").classList.remove("show"); Auth.openAuth(); };
$("#waLink").href = `https://wa.me/${STORE.whatsapp}`;
$("#year").textContent = new Date().getFullYear();
renderCategories(); renderProducts(); renderCart();
