// ====== TASURA — Halaman produk ======
const productUrl = p => `produk.html?id=${p.id}-${String(p.nama).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
const stars = r => "★★★★★".slice(0, Math.round(r)) + "☆☆☆☆☆".slice(0, 5 - Math.round(r));
let P = null, photos = [], qty = 1;
const habis = p => p.stok !== undefined && p.stok <= 0;
const ATTR_LABEL = { socket: "Socket", ram: "Tipe RAM", form: "Form factor", watt: "Daya (W)", panjang: "Panjang (mm)", vga_maks: "Panjang VGA maks. (mm)", igpu: "Grafis bawaan" };

async function loadProduct(id) {
  if (db) {
    const { data, error } = await db.from("products").select("*").eq("id", id).maybeSingle();
    if (!error) return data ? { ...fromDbProduct(data), gambarList: data.gambar_list || [], jumlahUlasan: data.jumlah_ulasan || 0, _all: null } : null;
  }
  const p = PRODUCTS.find(x => x.id === id);
  return p ? { ...p, gambarList: [], jumlahUlasan: 0 } : null;
}
async function loadAll() {
  if (!db) return PRODUCTS;
  const { data, error } = await db.from("products").select("*").eq("aktif", true);
  return error ? PRODUCTS : data.map(fromDbProduct);
}

function setMeta(p) {
  const desc = (p.deskripsi || `${p.nama} di Tasura`).slice(0, 155);
  document.title = `${p.nama} — ${rupiah(p.harga)} | Tasura`;
  document.querySelector('meta[name="description"]').content = desc;
  document.querySelector('meta[property="og:title"]').content = `${p.nama} — ${rupiah(p.harga)}`;
  const og = (n, v) => { let m = document.querySelector(`meta[property="${n}"]`); if (!m) { m = document.createElement("meta"); m.setAttribute("property", n); document.head.appendChild(m); } m.content = v; };
  og("og:description", desc); og("og:url", location.href);
  if (p.gambar) og("og:image", p.gambar);
  // Data terstruktur untuk Google (harga, stok, rating)
  const ld = document.createElement("script"); ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org", "@type": "Product", name: p.nama, description: p.deskripsi, category: p.kategori,
    ...(p.gambar ? { image: [p.gambar, ...p.gambarList] } : {}),
    offers: { "@type": "Offer", priceCurrency: "IDR", price: p.harga, url: location.href,
      availability: habis(p) ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" },
    ...(p.jumlahUlasan ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.jumlahUlasan } } : {}),
  });
  document.head.appendChild(ld);
}

function render(p, related) {
  photos = [p.gambar, ...p.gambarList].filter(Boolean);
  const disc = p.hargaCoret > p.harga ? Math.round((1 - p.harga / p.hargaCoret) * 100) : 0;
  const attrs = Object.entries(p.atribut || {}).filter(([k]) => ATTR_LABEL[k]);
  $("#productPage").innerHTML = `
    <nav class="crumbs"><a href="index.html">Beranda</a> / <a href="index.html#produk" data-cat-link="${esc(p.kategori)}">${esc(p.kategori)}</a> / <span>${esc(p.nama)}</span></nav>
    <section class="pd">
      <div class="gallery">
        <div class="gallery-main" id="galleryMain">${disc ? `<span class="disc">-${disc}%</span>` : ""}${photos.length ? `<img src="${esc(photos[0])}" alt="${esc(p.nama)}">` : `<span class="gallery-emoji">${esc(p.emoji)}</span>`}</div>
        ${photos.length > 1 ? `<div class="gallery-thumbs">${photos.map((u, i) => `<button class="${i ? "" : "active"}" data-photo="${i}"><img src="${esc(u)}" alt="Foto ${i + 1}"></button>`).join("")}</div>` : ""}
      </div>
      <div class="pd-info">
        <span class="cat">${esc(p.kategori)}</span>
        <h1>${esc(p.nama)}</h1>
        <div class="pd-meta"><span class="stars">${stars(p.rating)}</span> ${p.rating}${p.jumlahUlasan ? ` <a href="#ulasan" class="link">(${p.jumlahUlasan} ulasan)</a>` : ""} • ${p.terjual} terjual</div>
        <div class="pd-price"><b>${rupiah(p.harga)}</b>${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}</div>
        <div class="pd-stock ${habis(p) ? "out" : p.stok <= 5 ? "low" : ""}">${p.stok === undefined ? "" : habis(p) ? "Stok habis" : p.stok <= 5 ? `Sisa ${p.stok} lagi` : `Stok tersedia (${p.stok})`}</div>
        ${habis(p) ? `
          <form class="alert-form" id="alertForm">
            <b>🔔 Kabari saya saat stok tersedia</b>
            <div class="alert-row"><input name="nama" placeholder="Nama" maxlength="60" /><input name="hp" type="tel" placeholder="No. WhatsApp" required /></div>
            <button class="btn btn-primary" type="submit">Kabari Saya</button>
            <p class="msg" id="alertMsg" hidden></p>
          </form>` : `
          <div class="pd-buy">
            <div class="qty big"><button data-qty="-1" aria-label="Kurangi">−</button><span id="qtyVal">1</span><button data-qty="1" aria-label="Tambah">+</button></div>
            <button class="btn btn-primary" id="addCart">+ Keranjang</button>
            <button class="btn btn-ghost" id="buyNow">Beli Sekarang</button>
          </div>`}
        <div class="pd-actions">
          <a class="link" target="_blank" href="https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(`Halo ${STORE.nama}, saya mau tanya produk *${p.nama}* (${rupiah(p.harga)}): ${location.href}`)}">💬 Tanya via WhatsApp</a>
          <button class="link" id="compareBtn"></button>
          <button class="link" id="shareBtn">🔗 Bagikan</button>
          ${["Processor", "Motherboard", "RAM", "VGA", "Storage", "PSU", "Casing", "Cooler"].includes(p.kategori) ? `<a class="link" href="rakit.html">🧩 Rakit PC dengan komponen ini</a>` : ""}
        </div>
        ${p.deskripsi ? `<p class="pd-desc">${esc(p.deskripsi)}</p>` : ""}
      </div>
    </section>
    ${p.spek?.length || attrs.length ? `<section class="pd-section"><h2>Spesifikasi</h2>
      <table class="spec-table">${attrs.map(([k, v]) => `<tr><th>${ATTR_LABEL[k]}</th><td>${k === "igpu" ? (v ? "Ya" : "Tidak") : esc(String(v).replace(/,/g, ", "))}</td></tr>`).join("")}
      ${(p.spek || []).map(s => `<tr><td colspan="2">• ${esc(s)}</td></tr>`).join("")}</table></section>` : ""}
    <section class="pd-section" id="ulasan"><h2>Ulasan Pembeli</h2><div id="reviewForm"></div><div id="reviewList"><p class="muted">Memuat ulasan...</p></div></section>
    ${related.length ? `<section class="pd-section"><h2>Produk Serupa</h2><div class="related">${related.map(r => `
      <a class="rel-card" href="${productUrl(r)}"><div class="rel-thumb">${r.gambar ? `<img src="${esc(r.gambar)}" alt="">` : esc(r.emoji)}</div><b>${esc(r.nama)}</b><span>${rupiah(r.harga)}</span></a>`).join("")}</div></section>` : ""}`;
  syncCompareBtn();
}

function addToCart(go) {
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  const item = cart.find(i => !i.custom && i.id === P.id);
  if (P.stok !== undefined && (item?.qty || 0) + qty > P.stok) return toast(`Stok tersisa ${P.stok}${item ? ` (di keranjang sudah ${item.qty})` : ""}`);
  item ? item.qty += qty : cart.push({ id: P.id, qty });
  localStorage.setItem("tasura_cart", JSON.stringify(cart));
  updateCartCount();
  if (go) CartDrawer.open(); else toast("✓ Ditambahkan ke keranjang");
}
function syncCompareBtn() {
  const b = $("#compareBtn"); if (b) b.textContent = Compare.has(P.id) ? "✓ Dibandingkan (hapus)" : "⇄ Bandingkan";
}

// ---------- Ulasan ----------
async function loadReviews() {
  const box = $("#reviewList");
  if (!db) { box.innerHTML = `<p class="muted">Belum ada ulasan.</p>`; return; }
  const { data, error } = await db.from("reviews").select("nama,rating,komentar,created_at,approved").eq("product_id", P.id).order("created_at", { ascending: false }).limit(50);
  if (error) { box.innerHTML = `<p class="muted">Belum ada ulasan.</p>`; return; }
  const approved = data.filter(r => r.approved);
  if (!approved.length) { box.innerHTML = `<p class="muted">Belum ada ulasan untuk produk ini.</p>`; return; }
  const avg = approved.reduce((t, r) => t + r.rating, 0) / approved.length;
  const dist = [5, 4, 3, 2, 1].map(n => [n, approved.filter(r => r.rating === n).length]);
  box.innerHTML = `<div class="rev-summary"><div><b>${avg.toFixed(1)}</b><span class="stars">${stars(avg)}</span><small>${approved.length} ulasan</small></div>
      <div class="rev-bars">${dist.map(([n, c]) => `<div><span>${n}★</span><i><em style="width:${(c / approved.length) * 100}%"></em></i><span>${c}</span></div>`).join("")}</div></div>
    ${approved.map(r => `<article class="review"><div><b>${esc(r.nama)}</b> <span class="stars">${stars(r.rating)}</span><small>${new Date(r.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</small></div>${r.komentar ? `<p>${esc(r.komentar)}</p>` : ""}</article>`).join("")}`;
}

// Form ulasan untuk pembeli yang login dan pesanannya sudah Selesai
async function loadReviewForm() {
  if (!db) return;
  let session;
  try { session = (await db.auth.getSession()).data.session; } catch { return; }
  if (!session) return;
  const [{ data: orders }, { data: mine }] = await Promise.all([
    db.from("orders").select("id,status,items").eq("user_id", session.user.id).eq("status", "Selesai"),
    db.from("reviews").select("order_id,product_id,approved").eq("product_id", P.id).eq("user_id", session.user.id),
  ]);
  const done = new Set((mine || []).map(r => r.order_id));
  const order = (orders || []).find(o => o.items.some(i => i.id === P.id) && !done.has(o.id));
  if ((mine || []).some(r => !r.approved)) $("#reviewForm").innerHTML = `<p class="hint">Terima kasih! Ulasanmu sedang ditinjau admin sebelum ditampilkan.</p>`;
  if (!order) return;
  $("#reviewForm").innerHTML = `<form class="review-form" id="revForm">
    <b>Beri ulasan untuk pesanan #TSR-${order.id}</b>
    <div class="star-pick" id="starPick">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}">★</button>`).join("")}</div>
    <textarea name="komentar" rows="3" maxlength="1000" placeholder="Ceritakan pengalamanmu dengan produk ini (opsional)"></textarea>
    <p class="msg error" id="revMsg" hidden></p>
    <button class="btn btn-primary" type="submit">Kirim Ulasan</button></form>`;
  let rating = 0;
  const paint = () => document.querySelectorAll("#starPick button").forEach(b => b.classList.toggle("on", +b.dataset.star <= rating));
  $("#starPick").onclick = e => { const b = e.target.closest("[data-star]"); if (b) { rating = +b.dataset.star; paint(); } };
  $("#revForm").onsubmit = async e => {
    e.preventDefault();
    if (!rating) { $("#revMsg").textContent = "Pilih jumlah bintang dulu."; $("#revMsg").hidden = false; return; }
    const { error } = await db.rpc("submit_review", { p_order: order.id, p_product: P.id, p_rating: rating, p_komentar: e.target.komentar.value });
    if (error) { $("#revMsg").textContent = error.message; $("#revMsg").hidden = false; return; }
    $("#reviewForm").innerHTML = `<p class="hint">Terima kasih! Ulasanmu sedang ditinjau admin sebelum ditampilkan.</p>`;
  };
}

// ---------- Events ----------
document.addEventListener("click", async e => {
  const t = e.target;
  const ph = t.closest("[data-photo]");
  if (ph) {
    $("#galleryMain").querySelector("img").src = photos[+ph.dataset.photo];
    document.querySelectorAll(".gallery-thumbs button").forEach(b => b.classList.toggle("active", b === ph));
  }
  const q = t.closest("[data-qty]");
  if (q) { qty = Math.max(1, Math.min(P.stok ?? 99, qty + Number(q.dataset.qty))); $("#qtyVal").textContent = qty; }
  if (t.id === "addCart") addToCart(false);
  if (t.id === "buyNow") addToCart(true);
  if (t.id === "compareBtn") {
    const r = Compare.toggle(P.id);
    if (r === "full") toast(`Maksimal ${Compare.MAX} produk. Hapus salah satu di halaman Bandingkan.`);
    syncCompareBtn();
  }
  if (t.id === "shareBtn") {
    const data = { title: P.nama, text: `${P.nama} — ${rupiah(P.harga)} di Tasura`, url: location.href };
    if (navigator.share) { try { await navigator.share(data); } catch {} }
    else { try { await navigator.clipboard.writeText(location.href); toast("Link produk disalin ✓"); } catch { prompt("Salin link:", location.href); } }
  }
  const cl = t.closest("[data-cat-link]");
  if (cl) sessionStorage.setItem("tasura_cat", cl.dataset.catLink);
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "alertForm") return;
  e.preventDefault();
  const f = e.target, m = $("#alertMsg");
  if (!db) { m.textContent = "Fitur ini belum aktif, silakan tanya via WhatsApp."; m.className = "msg error"; m.hidden = false; return; }
  const { error } = await db.rpc("request_stock_alert", { p_product: P.id, p_nama: f.nama.value, p_hp: f.hp.value });
  m.hidden = false;
  if (error) { m.textContent = /function/i.test(error.message) ? "Fitur ini belum aktif, silakan tanya via WhatsApp." : error.message; m.className = "msg error"; return; }
  m.textContent = "✓ Siap! Kami akan mengabari lewat WhatsApp saat stok tersedia."; m.className = "msg success";
  f.querySelector("button").disabled = true;
});

(async () => {
  const id = parseInt(new URLSearchParams(location.search).get("id"), 10);
  await loadSettings();
  P = id ? await loadProduct(id) : null;
  if (!P) { $("#productPage").innerHTML = `<div class="empty-page"><h1>Produk tidak ditemukan</h1><p class="muted">Produk ini mungkin sudah tidak dijual.</p><a class="btn btn-primary" href="index.html#produk">Lihat Semua Produk</a></div>`; return; }
  const all = await loadAll();
  const related = all.filter(x => x.kategori === P.kategori && x.id !== P.id).slice(0, 4);
  setMeta(P); render(P, related);
  loadReviews(); loadReviewForm();
})();
