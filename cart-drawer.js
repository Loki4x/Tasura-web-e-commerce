// ====== Keranjang pop-up untuk halaman selain beranda ======
// Tombol keranjang di header langsung membuka panel keranjang di halaman yang sedang dibuka.
// Tombol Checkout membuka formulir data pengiriman (index.html?checkout=1).
const CartDrawer = (() => {
  const q = s => document.querySelector(s);
  const KEY = "tasura_cart";
  let products = null, loading = null;
  const read = () => JSON.parse(localStorage.getItem(KEY) || "[]");
  const write = c => { localStorage.setItem(KEY, JSON.stringify(c)); render(); };
  const keyOf = i => i.custom ? i.key : String(i.id);
  const find = id => (products || []).find(p => p.id === id);
  const rp = n => (typeof rupiah === "function" ? rupiah(n) : "Rp" + Number(n || 0).toLocaleString("id-ID"));
  const e = s => (typeof esc === "function" ? esc(s) : String(s ?? ""));

  function loadProducts() {
    if (products) return Promise.resolve(products);
    return loading ||= (async () => {
      try {
        if (typeof db !== "undefined" && db) {
          const { data, error } = await db.from("products").select("*").eq("aktif", true);
          if (!error && data) return (products = data.map(fromDbProduct));
        }
      } catch { /* pakai data cadangan */ }
      return (products = typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
    })();
  }

  function ensureMarkup() {
    if (q("#cartDrawer")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="overlay" id="overlay"></div>
      <aside class="drawer" id="cartDrawer" aria-label="Keranjang Belanja">
        <div class="drawer-head"><h3>Keranjang Belanja</h3><button class="icon-btn" id="closeCart" aria-label="Tutup">✕</button></div>
        <div class="cart-items" id="cartItems"></div>
        <div class="drawer-foot">
          <div class="row"><span>Subtotal</span><b id="cartTotal">Rp0</b></div>
          <button class="btn btn-primary full" id="checkoutBtn">Checkout</button>
        </div>
      </aside>`);
    q("#closeCart").onclick = close;
    q("#overlay").onclick = close;
    q("#checkoutBtn").onclick = () => {
      if (!read().length) return typeof toast === "function" && toast("Keranjang masih kosong");
      location.href = "index.html?checkout=1";
    };
    q("#cartItems").addEventListener("click", ev => {
      const t = ev.target.closest("[data-inc],[data-dec],[data-rm]"); if (!t) return;
      const k = t.dataset.inc || t.dataset.dec || t.dataset.rm;
      let cart = read(); const item = cart.find(i => keyOf(i) === k); if (!item) return;
      if (t.dataset.inc) {
        const p = !item.custom && find(item.id);
        if (p && p.stok !== undefined && item.qty + 1 > p.stok) return typeof toast === "function" && toast(`Stok tersisa ${p.stok}`);
        item.qty++;
      }
      if (t.dataset.dec) item.qty--;
      if (t.dataset.rm || item.qty < 1) cart = cart.filter(i => i !== item);
      write(cart);
    });
  }

  function render() {
    const cart = read();
    document.querySelectorAll("#cartCount").forEach(el => el.textContent = cart.reduce((s, i) => s + i.qty, 0));
    const box = q("#cartItems"); if (!box) return;
    if (!products) { box.innerHTML = `<div class="cart-empty">Memuat keranjang...</div>`; return; }
    const items = cart.filter(i => i.custom || find(i.id));
    const nReq = items.filter(i => i.custom).length;
    const total = items.reduce((s, i) => s + (i.custom ? 0 : find(i.id).harga * i.qty), 0);
    q("#cartTotal").textContent = rp(total) + (nReq ? ` + ${nReq} request` : "");
    if (!items.length) { box.innerHTML = `<div class="cart-empty">🛒<br/>Keranjangmu masih kosong</div>`; return; }
    box.innerHTML = items.map(i => {
      const k = e(keyOf(i));
      const qty = `<div class="qty"><button data-dec="${k}">−</button>${i.qty}<button data-inc="${k}">+</button></div>`;
      if (i.custom) return `<div class="ci is-req"><div class="ci-thumb">🛠️</div>
        <div class="ci-info"><h4><span class="req-tag">Request</span> ${e(i.slot ? i.slot + ": " : "")}${e(i.nama)}</h4><b class="tbd">Harga menyusul</b>${qty}</div>
        <button class="remove" data-rm="${k}">Hapus</button></div>`;
      const p = find(i.id);
      return `<div class="ci"><div class="ci-thumb">${p.gambar ? `<img src="${e(p.gambar)}" alt="${e(p.nama)}" loading="lazy">` : e(p.emoji)}</div>
        <div class="ci-info"><h4>${e(p.nama)}</h4><b>${rp(p.harga)}</b>${qty}</div>
        <button class="remove" data-rm="${k}">Hapus</button></div>`;
    }).join("");
  }

  function open() {
    ensureMarkup(); render();
    q("#cartDrawer").classList.add("open"); q("#overlay").classList.add("show");
    loadProducts().then(render);
  }
  function close() { q("#cartDrawer")?.classList.remove("open"); q("#overlay")?.classList.remove("show"); }

  // Tombol keranjang di header halaman ini membuka pop-up, bukan pindah ke beranda
  document.addEventListener("click", ev => {
    const a = ev.target.closest('a[href="index.html?keranjang=1"]');
    if (!a || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    ev.preventDefault(); open();
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") close(); });
  loadProducts(); // siapkan data agar keranjang langsung tampil saat dibuka
  return { open, close, render };
})();
