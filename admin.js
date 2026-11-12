// ====== TASURA — DASHBOARD ADMIN ======
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const STATUSES = ["Menunggu Konfirmasi", "Diproses", "Dikirim", "Selesai", "Dibatalkan"];
const PAID = ["Diproses", "Dikirim", "Selesai"]; // dihitung sebagai pendapatan
const S = { user: null, orders: [], products: [], coupons: [], customers: [], settings: {}, orderFilter: "Semua", editing: null };
const fmtDate = d => new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
const fmtDay = d => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const statusClass = s => "s-" + s.split(" ")[0].toLowerCase();
const badge = s => `<span class="status ${statusClass(s)}">${esc(s)}</span>`;
const toWa = hp => { let n = String(hp || "").replace(/\D/g, ""); if (n.startsWith("0")) n = "62" + n.slice(1); return n; };
const num = v => v === "" || v == null ? null : Number(v);
const siteUrl = location.href.split("#")[0].split("?")[0];

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
const openModal = id => $(id).classList.add("show");
const closeModals = () => $$(".modal").forEach(m => m.classList.remove("show"));
function busy(btn, on, label) { btn.disabled = on; if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || "Menyimpan..."; } else btn.textContent = btn.dataset.l; }

// ================== GERBANG LOGIN ==================
const G_ICON = `<svg viewBox="0 0 48 48" class="g"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;

function gate(html) { $("#app").hidden = true; $("#gate").hidden = false; $("#gateBody").innerHTML = html; }

function showLogin(msg = "") {
  gate(`
    <h2>Masuk Dashboard</h2>
    <p class="muted">Gunakan akun yang sudah dijadikan admin.</p>
    <button class="btn btn-google full" id="gGoogle">${G_ICON} Masuk dengan Google</button>
    <div class="divider"><span>atau dengan email</span></div>
    <form id="gForm" class="form-grid">
      <label>Email<input class="input" name="email" type="email" required autocomplete="email" /></label>
      <label>Password<input class="input" name="password" type="password" required autocomplete="current-password" /></label>
      <p class="msg error" id="gMsg" ${msg ? "" : "hidden"}>${esc(msg)}</p>
      <button class="btn btn-primary full" type="submit">Masuk</button>
    </form>`);
  $("#gGoogle").onclick = () => db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteUrl } });
  $("#gForm").onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button");
    busy(btn, true, "Memproses...");
    const { error } = await db.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    busy(btn, false);
    if (error) { $("#gMsg").textContent = error.message === "Invalid login credentials" ? "Email atau password salah." : error.message; $("#gMsg").hidden = false; }
  };
}

function showNotAdmin() {
  gate(`
    <h2>Bukan Akun Admin</h2>
    <p>Kamu masuk sebagai <b>${esc(S.user.email)}</b>, tetapi akun ini belum terdaftar sebagai admin.</p>
    <p class="muted">Untuk menjadikannya admin, jalankan perintah ini di Supabase → SQL Editor:</p>
    <pre class="code">insert into public.admins (user_id)
select id from auth.users where email = '${esc(S.user.email)}'
on conflict do nothing;</pre>
    <p class="muted">Pastikan file <b>supabase/002_admin.sql</b> sudah dijalankan lebih dulu. Setelah itu muat ulang halaman ini.</p>
    <div class="row-2"><button class="btn btn-ghost full" id="gOut">Keluar</button><button class="btn btn-primary full" onclick="location.reload()">Muat Ulang</button></div>`);
  $("#gOut").onclick = () => db.auth.signOut();
}

async function onSession(session) {
  S.user = session?.user || null;
  if (!S.user) return showLogin();
  gate(`<p class="muted">Memeriksa akses admin...</p>`);
  const { data, error } = await db.rpc("is_admin");
  if (error) return gate(`<h2>Database belum siap</h2><p class="muted">Fungsi <b>is_admin</b> belum ada. Jalankan <b>supabase/002_admin.sql</b> di Supabase → SQL Editor, lalu muat ulang.</p><pre class="code">${esc(error.message)}</pre>`);
  if (data !== true) return showNotAdmin();
  $("#gate").hidden = true; $("#app").hidden = false;
  $("#adminEmail").textContent = S.user.email;
  if (!S.loaded) { S.loaded = true; await loadAll(); subscribeOrders(); }
}

// ================== MUAT DATA ==================
async function loadAll() {
  const [o, p, c, cu, st] = await Promise.all([
    db.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
    db.from("products").select("*").order("urutan").order("id"),
    db.from("coupons").select("*").order("created_at", { ascending: false }),
    db.from("profiles").select("*"),
    db.from("settings").select("key,value"),
  ]);
  const err = [o, p, c, cu, st].find(r => r.error);
  if (err) toast("Gagal memuat sebagian data: " + err.error.message);
  S.orders = o.data || []; S.products = p.data || []; S.coupons = c.data || []; S.customers = cu.data || [];
  S.settings = Object.fromEntries((st.data || []).map(r => [r.key, r.value]));
  renderAllViews();
}
function renderAllViews() { renderSummary(); renderOrders(); renderProducts(); renderCoupons(); renderCustomers(); renderSettings(); updateBadge(); }

function updateBadge() {
  const n = S.orders.filter(o => o.status === "Menunggu Konfirmasi").length;
  $("#newBadge").hidden = !n; $("#newBadge").textContent = n;
  document.title = (n ? `(${n}) ` : "") + "Dashboard Admin — Tasura";
}

// Notifikasi pesanan baru secara langsung (Supabase Realtime)
function subscribeOrders() {
  db.channel("admin-orders")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, async ({ new: o }) => {
      S.orders.unshift(o);
      const { data } = await db.from("products").select("*").order("urutan").order("id");
      if (data) S.products = data;
      renderAllViews();
      toast(`🔔 Pesanan baru #TSR-${o.id} dari ${o.nama}`);
    })
    .subscribe();
}

// ================== NAVIGASI ==================
function go(view) {
  $$("#sideNav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach(v => v.hidden = v.dataset.view !== view);
  window.scrollTo(0, 0);
}
$$("#sideNav button").forEach(b => b.onclick = () => go(b.dataset.view));
document.addEventListener("click", e => {
  const g = e.target.closest("[data-goto]"); if (g) go(g.dataset.goto);
  if (e.target.closest("[data-refresh]")) loadAll().then(() => toast("Data diperbarui"));
  if (e.target.closest("[data-close-modal]")) closeModals();
  if (e.target.classList.contains("modal")) closeModals();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });

// ================== RINGKASAN ==================
function renderSummary() {
  const now = new Date(), monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonth = S.orders.filter(o => new Date(o.created_at) >= monthStart);
  const revenue = thisMonth.filter(o => PAID.includes(o.status)).reduce((s, o) => s + o.total, 0);
  const waiting = S.orders.filter(o => o.status === "Menunggu Konfirmasi").length;
  const shipping = S.orders.filter(o => o.status === "Diproses").length;
  const low = S.products.filter(p => p.aktif && p.stok <= 5).sort((a, b) => a.stok - b.stok);
  $("#todayText").textContent = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("#statCards").innerHTML = [
    ["Pendapatan Bulan Ini", rupiah(revenue), "Pesanan diproses, dikirim & selesai"],
    ["Perlu Dikonfirmasi", waiting, (() => { const n = S.orders.filter(o => pendingReq(o) && o.status !== "Dibatalkan").length; return n ? `${n} berisi komponen yang perlu dicarikan` : "Pesanan menunggu konfirmasi"; })(), waiting ? "alert" : ""],
    ["Perlu Dikirim", shipping, "Pesanan berstatus diproses"],
    ["Pesanan Bulan Ini", thisMonth.length, `${S.products.filter(p => p.aktif).length} produk aktif • ${S.customers.length} pelanggan`],
  ].map(([t, v, s, cls]) => `<div class="stat ${cls || ""}"><span>${t}</span><b>${v}</b><small>${s}</small></div>`).join("");
  const recent = S.orders.slice(0, 6);
  $("#recentOrders").innerHTML = recent.length ? `<table class="table compact">${recent.map(o => `
    <tr data-order="${o.id}"><td><b>#TSR-${o.id}</b><small>${fmtDate(o.created_at)}</small></td><td>${esc(o.nama)} ${reqBadge(o)}</td><td>${rupiah(o.total)}</td><td>${badge(o.status)}</td></tr>`).join("")}</table>`
    : `<p class="empty-note">Belum ada pesanan.</p>`;
  $("#lowStock").innerHTML = low.length ? `<table class="table compact">${low.slice(0, 8).map(p => `
    <tr data-product="${p.id}"><td>${esc(p.nama)}</td><td class="right"><span class="stock-pill ${p.stok <= 0 ? "out" : "low"}">${p.stok <= 0 ? "Habis" : "Sisa " + p.stok}</span></td></tr>`).join("")}</table>`
    : `<p class="empty-note">Semua stok aman 👍</p>`;
}

// ================== PESANAN ==================
function renderOrders() {
  const counts = Object.fromEntries(STATUSES.map(s => [s, S.orders.filter(o => o.status === s).length]));
  const nReq = S.orders.filter(o => pendingReq(o) && o.status !== "Dibatalkan").length;
  $("#orderFilters").innerHTML = ["Semua", ...STATUSES].map(s =>
    `<button class="chip ${S.orderFilter === s ? "active" : ""}" data-of="${s}">${s} <small>${s === "Semua" ? S.orders.length : counts[s]}</small></button>`).join("") +
    (nReq || S.orderFilter === "Request" ? `<button class="chip chip-req ${S.orderFilter === "Request" ? "active" : ""}" data-of="Request">🛠 Perlu Dicarikan <small>${nReq}</small></button>` : "");
  const q = $("#orderSearch").value.trim().toLowerCase().replace("#tsr-", "");
  const list = S.orders.filter(o => (S.orderFilter === "Semua" || o.status === S.orderFilter || (S.orderFilter === "Request" && pendingReq(o) && o.status !== "Dibatalkan")) &&
    (!q || [o.id, o.nama, o.hp].join(" ").toLowerCase().includes(q)));
  $("#ordersTable").innerHTML = `<thead><tr><th>No. Pesanan</th><th>Pelanggan</th><th>Produk</th><th>Total</th><th>Pembayaran</th><th>Status</th></tr></thead><tbody>` +
    (list.length ? list.map(o => `
      <tr data-order="${o.id}" class="clickable">
        <td><b>#TSR-${o.id}</b><small>${fmtDate(o.created_at)}</small></td>
        <td>${esc(o.nama)}<small>${esc(o.hp)}${o.user_id ? "" : " • Tamu"}</small></td>
        <td>${o.items.length} item ${reqBadge(o)}<small>${esc(o.items[0]?.nama || "")}${o.items.length > 1 ? " +" + (o.items.length - 1) : ""}</small></td>
        <td><b>${rupiah(o.total)}</b>${o.promo ? `<small>${esc(o.promo)}</small>` : ""}</td>
        <td>${esc(o.pembayaran)}</td>
        <td>${badge(o.status)}${o.resi ? `<small>Resi ${esc(o.resi)}</small>` : ""}</td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-note">Tidak ada pesanan.</td></tr>`) + "</tbody>";
}
$("#orderFilters").onclick = e => { const b = e.target.closest("[data-of]"); if (b) { S.orderFilter = b.dataset.of; renderOrders(); } };
$("#orderSearch").oninput = renderOrders;
document.addEventListener("click", e => {
  const r = e.target.closest("[data-order]"); if (r) openOrder(+r.dataset.order);
  const p = e.target.closest("[data-product]"); if (p && !e.target.closest("button,input,label")) openProduct(+p.dataset.product);
});

// ---- Komponen request (dari Rakit PC) ----
const hasReq = o => o.items.some(i => i.custom);
const pendingReq = o => o.items.some(i => i.custom && !i.harga);
const reqBadge = o => hasReq(o) ? `<span class="req-badge ${pendingReq(o) ? "" : "done"}">${pendingReq(o) ? "🛠 Perlu dicarikan" : "🛠 Request ✓"}</span>` : "";
const searchLinks = q => {
  const e = encodeURIComponent(q);
  return `<span class="search-links">Cari di:
    <a href="https://www.tokopedia.com/search?st=product&q=${e}" target="_blank" rel="noopener">Tokopedia</a>
    <a href="https://shopee.co.id/search?keyword=${e}" target="_blank" rel="noopener">Shopee</a>
    <a href="https://www.google.com/search?tbm=shop&q=${e}" target="_blank" rel="noopener">Google</a></span>`;
};
// Hitung ulang subtotal & total dari harga yang diisi admin untuk item request
function repriced(o, form) {
  const items = o.items.map((i, idx) => i.custom ? { ...i, harga: Math.max(0, Number(form[`req_${idx}`]?.value) || 0) } : i);
  const subtotal = items.reduce((t, i) => t + i.harga * i.qty, 0);
  return { items, subtotal, total: Math.max(0, subtotal - (o.diskon || 0)) };
}

function customerMsg(o) {
  const head = `Halo ${o.nama}, ini dari Tasura mengenai pesanan *#TSR-${o.id}* (${rupiah(o.total)}).`;
  return {
    "Menunggu Konfirmasi": hasReq(o)
      ? `${head}\nBerikut harga komponen request yang sudah kami carikan:\n` +
        o.items.filter(i => i.custom).map(i => `• ${i.slot ? i.slot + ": " : ""}${i.nama} x${i.qty} = ${i.harga ? rupiah(i.harga * i.qty) : "masih kami carikan"}`).join("\n") +
        `\n\n*Total pesanan menjadi ${rupiah(o.total)}*. Jika setuju, mohon konfirmasi agar kami proses ya 🙏`
      : `${head}\nPesananmu sudah kami terima dan sedang kami cek ketersediaannya.`,
    "Diproses": `${head}\nPesanan sudah dikonfirmasi dan sedang kami siapkan. 🙏`,
    "Dikirim": `${head}\nPesananmu sudah dikirim! 🚚${o.resi ? `\nNo. resi: *${o.resi}*` : ""}`,
    "Selesai": `${head}\nTerima kasih sudah berbelanja di Tasura! Semoga puas dengan produknya 🙌`,
    "Dibatalkan": `${head}\nMohon maaf, pesanan ini dibatalkan.`,
  }[o.status];
}

function openOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const cust = o.user_id && S.customers.find(c => c.id === o.user_id);
  $("#orderBox").innerHTML = `
    <div class="drawer-head"><div><h3>Pesanan #TSR-${o.id}</h3><span class="muted">${fmtDate(o.created_at)}</span></div><button class="icon-btn" data-close-modal>✕</button></div>
    <div class="order-grid">
      <div>
        <h4>Produk</h4>
        ${hasReq(o) ? `<p class="req-help">🛠 Pesanan ini berisi komponen <b>request</b>. Cari komponennya di toko lain, isi harga jualnya, lalu klik <b>Simpan</b> dan kabari pelanggan.</p>` : ""}
        <table class="table compact">${o.items.map((i, idx) => i.custom ? `
          <tr class="req-row"><td><span class="req-tag">Request</span> ${esc(i.slot ? i.slot + ": " : "")}<b>${esc(i.nama)}</b> × ${i.qty}${searchLinks(i.nama)}</td>
            <td class="right"><label class="price-in">Rp<input type="number" min="0" step="1000" name="req_${idx}" form="orderForm" value="${i.harga || ""}" placeholder="Harga satuan" /></label></td></tr>`
          : `<tr><td>${esc(i.nama)}<small>${rupiah(i.harga)} × ${i.qty}</small></td><td class="right">${rupiah(i.harga * i.qty)}</td></tr>`).join("")}
          <tr><td>Subtotal</td><td class="right" id="oSubtotal">${rupiah(o.subtotal)}</td></tr>
          ${o.diskon ? `<tr><td>Diskon <span class="chip-mini">${esc(o.promo || "")}</span></td><td class="right">-${rupiah(o.diskon)}</td></tr>` : ""}
          <tr class="total-row"><td><b>Total</b></td><td class="right"><b id="oTotal">${rupiah(o.total)}</b></td></tr>
        </table>
        <h4>Pengiriman</h4>
        <dl class="dl">
          <dt>Nama</dt><dd>${esc(o.nama)}</dd>
          <dt>No. HP</dt><dd>${esc(o.hp)}</dd>
          <dt>Alamat</dt><dd>${esc(o.alamat)}</dd>
          <dt>Pembayaran</dt><dd>${esc(o.pembayaran)}</dd>
          <dt>Akun</dt><dd>${cust ? esc(cust.email || cust.nama || "Pelanggan") : "Tamu (tanpa login)"}</dd>
          ${o.catatan ? `<dt>Catatan</dt><dd class="note">${esc(o.catatan)}</dd>` : ""}
          ${o.lokasi_lat != null ? `<dt>Titik lokasi</dt><dd><a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${o.lokasi_lat},${o.lokasi_lng}">📍 Buka di Google Maps</a>
            <iframe class="mini-map" loading="lazy" title="Lokasi pengiriman" src="https://www.openstreetmap.org/export/embed.html?bbox=${o.lokasi_lng - 0.004},${o.lokasi_lat - 0.003},${o.lokasi_lng + 0.004},${o.lokasi_lat + 0.003}&layer=mapnik&marker=${o.lokasi_lat},${o.lokasi_lng}"></iframe></dd>` : ""}
        </dl>
      </div>
      <form class="form-grid order-side" id="orderForm">
        <label>Status Pesanan
          <select class="input" name="status">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        </label>
        <label>No. Resi Pengiriman<input class="input" name="resi" value="${esc(o.resi || "")}" placeholder="Contoh: JNE1234567890" /></label>
        <label>Catatan Internal<textarea class="input" name="catatan_admin" rows="3" placeholder="Hanya terlihat oleh admin">${esc(o.catatan_admin || "")}</textarea></label>
        <small class="muted">Status <b>Dibatalkan</b> otomatis mengembalikan stok produk dan kuota kupon.</small>
        <button class="btn btn-primary full" type="submit">Simpan Perubahan</button>
        <a class="btn btn-wa-green full" id="waCustomer" target="_blank">💬 Chat Pelanggan via WhatsApp</a>
        <a class="btn btn-ghost full" target="_blank" href="invoice.html?id=${o.id}">🧾 Lihat / Cetak Invoice</a>
        <button type="button" class="link danger" id="deleteOrder">Hapus pesanan ini</button>
      </form>
    </div>`;
  const form = $("#orderForm");
  const updateWa = () => {
    const r = hasReq(o) ? repriced(o, form) : {};
    if (hasReq(o)) { $("#oSubtotal").textContent = rupiah(r.subtotal); $("#oTotal").textContent = rupiah(r.total); }
    $("#waCustomer").href = `https://wa.me/${toWa(o.hp)}?text=${encodeURIComponent(customerMsg({ ...o, ...r, status: form.status.value, resi: form.resi.value.trim() }))}`;
  };
  updateWa(); form.status.onchange = updateWa; form.resi.oninput = updateWa;
  $$("[name^=req_]").forEach(i => i.oninput = updateWa);
  form.onsubmit = async e => {
    e.preventDefault();
    const btn = form.querySelector("button[type=submit]"); busy(btn, true);
    const prevStatus = o.status;
    const upd = { status: form.status.value, resi: form.resi.value.trim() || null, catatan_admin: form.catatan_admin.value.trim() || null,
      ...(hasReq(o) ? repriced(o, form) : {}) };
    const { data, error } = await db.from("orders").update(upd).eq("id", o.id).select().single();
    busy(btn, false);
    if (error) return toast("Gagal menyimpan: " + error.message);
    Object.assign(o, data);
    if (upd.status !== prevStatus) { const { data: p } = await db.from("products").select("*").order("urutan").order("id"); if (p) S.products = p; }
    renderAllViews(); toast("Pesanan disimpan ✓"); closeModals();
  };
  $("#deleteOrder").onclick = async () => {
    if (!confirm(`Hapus pesanan #TSR-${o.id} secara permanen?\nStok TIDAK dikembalikan. Untuk mengembalikan stok, ubah status menjadi Dibatalkan.`)) return;
    const { error } = await db.from("orders").delete().eq("id", o.id);
    if (error) return toast("Gagal menghapus: " + error.message);
    S.orders = S.orders.filter(x => x.id !== o.id); renderAllViews(); closeModals(); toast("Pesanan dihapus");
  };
  openModal("#orderModal");
}

// ================== PRODUK ==================
function renderProducts() {
  const cats = [...new Set(S.products.map(p => p.kategori))].sort();
  const sel = $("#productCat"), cur = sel.value;
  sel.innerHTML = `<option value="">Semua kategori</option>` + cats.map(c => `<option ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
  $("#catList").innerHTML = cats.map(c => `<option value="${esc(c)}">`).join("");
  const q = $("#productSearch").value.trim().toLowerCase();
  const list = S.products.filter(p => (!sel.value || p.kategori === sel.value) && (!q || p.nama.toLowerCase().includes(q)));
  $("#productsTable").innerHTML = `<thead><tr><th>Produk</th><th>Harga</th><th>Stok</th><th>Terjual</th><th>Aktif</th><th></th></tr></thead><tbody>` +
    (list.length ? list.map(p => `
      <tr data-product="${p.id}" class="clickable ${p.aktif ? "" : "inactive"}">
        <td><div class="prod-cell"><div class="thumb-sm">${p.gambar ? `<img src="${esc(p.gambar)}" alt="">` : esc(p.emoji || "📦")}</div><div>${esc(p.nama)}<small>${esc(p.kategori)}</small></div></div></td>
        <td><b>${rupiah(p.harga)}</b>${p.harga_coret ? `<small><s>${rupiah(p.harga_coret)}</s></small>` : ""}</td>
        <td><span class="stock-pill ${p.stok <= 0 ? "out" : p.stok <= 5 ? "low" : ""}">${p.stok}</span></td>
        <td>${p.terjual}</td>
        <td><label class="switch"><input type="checkbox" data-toggle-product="${p.id}" ${p.aktif ? "checked" : ""}><span></span></label></td>
        <td class="right"><button class="link" data-edit-product="${p.id}">Edit</button> <button class="link danger" data-del-product="${p.id}">Hapus</button></td>
      </tr>`).join("") : `<tr><td colspan="6" class="empty-note">Tidak ada produk.</td></tr>`) + "</tbody>";
}
$("#productCat").onchange = renderProducts;
$("#productSearch").oninput = renderProducts;
$("#productsTable").addEventListener("change", async e => {
  const id = +e.target.dataset.toggleProduct; if (!id) return;
  const { error } = await db.from("products").update({ aktif: e.target.checked }).eq("id", id);
  if (error) { e.target.checked = !e.target.checked; return toast("Gagal: " + error.message); }
  S.products.find(p => p.id === id).aktif = e.target.checked; renderProducts(); renderSummary();
  toast(e.target.checked ? "Produk ditampilkan di toko" : "Produk disembunyikan dari toko");
});
$("#productsTable").addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit-product]"); if (ed) return openProduct(+ed.dataset.editProduct);
  const del = e.target.closest("[data-del-product]"); if (!del) return;
  const p = S.products.find(x => x.id === +del.dataset.delProduct);
  if (!confirm(`Hapus "${p.nama}" secara permanen?\n\nTips: matikan tombol Aktif jika hanya ingin menyembunyikannya dari toko.`)) return;
  const { error } = await db.from("products").delete().eq("id", p.id);
  if (error) return toast("Gagal menghapus: " + error.message);
  S.products = S.products.filter(x => x.id !== p.id); renderProducts(); renderSummary(); toast("Produk dihapus");
});

function setPreview(url, emoji) {
  $("#imgPreview").innerHTML = url ? `<img src="${esc(url)}" alt="">` : esc(emoji || "📦");
  $("#imgRemove").hidden = !url;
}
// ---- Kompatibilitas Rakit PC ----
const BUILDER_CATS = ["Processor", "Motherboard", "RAM", "VGA", "Storage", "PSU", "Casing", "Cooler"];
const COMPAT_LABEL = {
  Processor: { c_socket: "Socket", c_watt: "TDP (W)" }, Motherboard: { c_socket: "Socket", c_form: "Ukuran (form factor)" },
  Cooler: { c_socket: "Socket didukung (pisahkan koma)" }, Casing: { c_form: "Ukuran motherboard maksimal" },
  VGA: { c_watt: "Konsumsi daya (W)" }, PSU: { c_watt: "Kapasitas daya (W)" },
};
function syncCompat() {
  const f = $("#productForm"), raw = f.kategori.value.trim();
  const kat = BUILDER_CATS.find(k => k.toLowerCase() === raw.toLowerCase());
  let shown = 0;
  $$("#compatBox [data-for]").forEach(el => {
    const on = !!kat && el.dataset.for.split(",").includes(kat);
    el.hidden = !on; if (on) shown++;
    const lbl = el.querySelector("[data-lbl]"), name = el.querySelector("input,select")?.name;
    if (on && lbl && COMPAT_LABEL[kat]?.[name]) lbl.textContent = COMPAT_LABEL[kat][name];
  });
  $("#compatHint").textContent = !kat ? `Kategori ini tidak dipakai di halaman Rakit PC. Kategori yang dipakai: ${BUILDER_CATS.join(", ")}.`
    : shown ? "Diisi agar halaman Rakit PC bisa mengecek kecocokan komponen ini." : "Kategori ini tidak butuh data kompatibilitas.";
}
function readCompat() {
  const a = {};
  $$("#compatBox [data-for]").forEach(el => {
    if (el.hidden) return;
    const i = el.querySelector("input,select"), k = i.name.slice(2);
    if (i.type === "checkbox") a[k] = i.checked;
    else if (i.value.trim() !== "") a[k] = i.type === "number" ? Number(i.value) : i.value.trim().replace(/\s*,\s*/g, ",");
  });
  return a;
}
$("#productForm").kategori.addEventListener("input", syncCompat);

function openProduct(id) {
  const p = id ? S.products.find(x => x.id === id) : null;
  S.editing = p;
  const f = $("#productForm"); f.reset();
  $("#productTitle").textContent = p ? "Edit Produk" : "Tambah Produk";
  $("#productError").hidden = true;
  const v = p || { stok: 0, urutan: 0, rating: 5, terjual: 0, emoji: "📦", aktif: true, spek: [] };
  ["nama", "kategori", "harga", "stok", "urutan", "rating", "terjual", "emoji", "deskripsi"].forEach(k => f[k].value = v[k] ?? "");
  f.harga_coret.value = v.harga_coret || "";
  f.gambar.value = v.gambar || "";
  f.spek.value = (v.spek || []).join("\n");
  f.aktif.checked = v.aktif;
  const at = v.atribut || {};
  ["socket", "ram", "form", "watt", "panjang", "vga_maks"].forEach(k => f["c_" + k].value = at[k] ?? "");
  f.c_igpu.checked = at.igpu === true;
  syncCompat();
  setPreview(f.gambar.value, f.emoji.value);
  openModal("#productModal");
}
$("#addProductBtn").onclick = () => openProduct(null);
$("#productForm").emoji.oninput = e => { if (!$("#productForm").gambar.value) setPreview("", e.target.value); };
$("#imgRemove").onclick = () => { $("#productForm").gambar.value = ""; setPreview("", $("#productForm").emoji.value); };
$("#imgFile").onchange = async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("File harus berupa gambar");
  if (file.size > 2 * 1024 * 1024) return toast("Ukuran foto maksimal 2 MB");
  $("#imgPreview").innerHTML = `<small class="muted">Mengupload...</small>`;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await db.storage.from("produk").upload(path, file, { cacheControl: "31536000", contentType: file.type });
  if (error) { setPreview($("#productForm").gambar.value, $("#productForm").emoji.value); return toast("Upload gagal: " + error.message); }
  const url = db.storage.from("produk").getPublicUrl(path).data.publicUrl;
  $("#productForm").gambar.value = url; setPreview(url); toast("Foto terupload ✓");
};
$("#productForm").onsubmit = async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button[type=submit]");
  const row = {
    nama: f.nama.value.trim(), kategori: f.kategori.value.trim(), harga: num(f.harga.value), harga_coret: num(f.harga_coret.value) || 0,
    stok: num(f.stok.value) ?? 0, urutan: num(f.urutan.value) ?? 0, rating: num(f.rating.value) ?? 5, terjual: num(f.terjual.value) ?? 0,
    emoji: f.emoji.value.trim() || "📦", gambar: f.gambar.value || null, deskripsi: f.deskripsi.value.trim(),
    spek: f.spek.value.split("\n").map(s => s.trim()).filter(Boolean), aktif: f.aktif.checked, updated_at: new Date().toISOString(),
    atribut: readCompat(),
  };
  if (row.harga_coret && row.harga_coret <= row.harga) { $("#productError").textContent = "Harga coret harus lebih besar dari harga jual (atau kosongkan)."; $("#productError").hidden = false; return; }
  busy(btn, true);
  const q = S.editing ? db.from("products").update(row).eq("id", S.editing.id) : db.from("products").insert(row);
  const { data, error } = await q.select().single();
  busy(btn, false);
  if (error) { $("#productError").textContent = error.message; $("#productError").hidden = false; return; }
  if (S.editing) Object.assign(S.editing, data); else S.products.push(data);
  renderProducts(); renderSummary(); closeModals(); toast("Produk disimpan ✓");
};

// ================== KUPON ==================
function couponState(c) {
  if (!c.aktif) return ["Nonaktif", "s-dibatalkan"];
  if (c.berlaku_sampai && new Date(c.berlaku_sampai) < new Date()) return ["Kedaluwarsa", "s-dibatalkan"];
  if (c.kuota && c.terpakai >= c.kuota) return ["Kuota Habis", "s-dibatalkan"];
  return ["Aktif", "s-selesai"];
}
function renderCoupons() {
  $("#couponsTable").innerHTML = `<thead><tr><th>Kode</th><th>Potongan</th><th>Min. Belanja</th><th>Dipakai</th><th>Berlaku Sampai</th><th>Status</th><th></th></tr></thead><tbody>` +
    (S.coupons.length ? S.coupons.map(c => {
      const [st, cls] = couponState(c);
      return `<tr>
        <td><span class="code-pill">${esc(c.kode)}</span></td>
        <td><b>${c.tipe === "persen" ? c.nilai + "%" : rupiah(c.nilai)}</b>${c.tipe === "persen" && c.maks_diskon ? `<small>maks. ${rupiah(c.maks_diskon)}</small>` : ""}</td>
        <td>${c.min_belanja ? rupiah(c.min_belanja) : "—"}</td>
        <td>${c.terpakai}${c.kuota ? ` / ${c.kuota}` : " kali"}</td>
        <td>${c.berlaku_sampai ? fmtDay(c.berlaku_sampai) : "Tanpa batas"}</td>
        <td><span class="status ${cls}">${st}</span></td>
        <td class="right"><button class="link" data-edit-coupon="${c.id}">Edit</button> <button class="link danger" data-del-coupon="${c.id}">Hapus</button></td>
      </tr>`;
    }).join("") : `<tr><td colspan="7" class="empty-note">Belum ada kupon.</td></tr>`) + "</tbody>";
}
$("#couponsTable").onclick = async e => {
  const ed = e.target.closest("[data-edit-coupon]"); if (ed) return openCoupon(+ed.dataset.editCoupon);
  const del = e.target.closest("[data-del-coupon]"); if (!del) return;
  const c = S.coupons.find(x => x.id === +del.dataset.delCoupon);
  if (!confirm(`Hapus kupon ${c.kode}?`)) return;
  const { error } = await db.from("coupons").delete().eq("id", c.id);
  if (error) return toast("Gagal menghapus: " + error.message);
  S.coupons = S.coupons.filter(x => x.id !== c.id); renderCoupons(); toast("Kupon dihapus");
};
function syncCouponType() {
  const persen = $("#couponForm").tipe.value === "persen";
  $("#nilaiLabel").textContent = persen ? "Besar Potongan (%)" : "Besar Potongan (Rp)";
  $("#couponForm").nilai.max = persen ? 100 : "";
  $("#maksWrap").hidden = !persen;
}
$("#couponForm").tipe.onchange = syncCouponType;
function openCoupon(id) {
  const c = id ? S.coupons.find(x => x.id === id) : null;
  S.editing = c;
  const f = $("#couponForm"); f.reset();
  $("#couponTitle").textContent = c ? "Edit Kupon" : "Buat Kupon";
  $("#couponError").hidden = true;
  if (c) {
    ["kode", "tipe", "nilai", "min_belanja"].forEach(k => f[k].value = c[k]);
    f.maks_diskon.value = c.maks_diskon || ""; f.kuota.value = c.kuota || "";
    f.berlaku_sampai.value = c.berlaku_sampai ? new Date(c.berlaku_sampai).toLocaleDateString("sv-SE") : "";
    f.aktif.checked = c.aktif;
  }
  syncCouponType();
  openModal("#couponModal");
}
$("#addCouponBtn").onclick = () => openCoupon(null);
$("#couponForm").onsubmit = async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button[type=submit]");
  const row = {
    kode: f.kode.value.trim().toUpperCase(), tipe: f.tipe.value, nilai: num(f.nilai.value),
    maks_diskon: f.tipe.value === "persen" ? num(f.maks_diskon.value) : null,
    min_belanja: num(f.min_belanja.value) || 0, kuota: num(f.kuota.value),
    berlaku_sampai: f.berlaku_sampai.value ? new Date(f.berlaku_sampai.value + "T23:59:59").toISOString() : null,
    aktif: f.aktif.checked,
  };
  busy(btn, true);
  const q = S.editing ? db.from("coupons").update(row).eq("id", S.editing.id) : db.from("coupons").insert(row);
  const { data, error } = await q.select().single();
  busy(btn, false);
  if (error) {
    $("#couponError").textContent = error.code === "23505" ? `Kode ${row.kode} sudah dipakai kupon lain.` : error.message;
    $("#couponError").hidden = false; return;
  }
  if (S.editing) Object.assign(S.editing, data); else S.coupons.unshift(data);
  renderCoupons(); closeModals(); toast("Kupon disimpan ✓");
};

// ================== PELANGGAN ==================
function renderCustomers() {
  const q = $("#customerSearch").value.trim().toLowerCase();
  const rows = S.customers.map(c => {
    const os = S.orders.filter(o => o.user_id === c.id);
    return { ...c, jumlah: os.length, belanja: os.filter(o => o.status !== "Dibatalkan").reduce((s, o) => s + o.total, 0), terakhir: os[0]?.created_at };
  }).filter(c => !q || [c.nama, c.email, c.hp].join(" ").toLowerCase().includes(q))
    .sort((a, b) => b.belanja - a.belanja || (b.terakhir || "").localeCompare(a.terakhir || ""));
  const guests = S.orders.filter(o => !o.user_id).length;
  $("#customersTable").innerHTML = `<thead><tr><th>Pelanggan</th><th>No. HP</th><th>Pesanan</th><th>Total Belanja</th><th>Terakhir Pesan</th><th></th></tr></thead><tbody>` +
    (rows.length ? rows.map(c => `<tr>
      <td><div class="prod-cell"><div class="avatar-sm">${c.avatar_url ? `<img src="${esc(c.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc((c.nama || c.email || "?")[0].toUpperCase())}</div><div>${esc(c.nama || "—")}<small>${esc(c.email || "")}</small></div></div></td>
      <td>${esc(c.hp || "—")}</td><td>${c.jumlah}</td><td><b>${rupiah(c.belanja)}</b></td>
      <td>${c.terakhir ? fmtDay(c.terakhir) : "—"}</td>
      <td class="right">${c.hp ? `<a class="link" target="_blank" href="https://wa.me/${toWa(c.hp)}">WhatsApp</a>` : ""}</td>
    </tr>`).join("") : `<tr><td colspan="6" class="empty-note">Belum ada pelanggan.</td></tr>`) + "</tbody>" +
    (guests ? `<tfoot><tr><td colspan="6" class="muted">+ ${guests} pesanan dari tamu (tanpa akun)</td></tr></tfoot>` : "");
}
$("#customerSearch").oninput = renderCustomers;

// ================== PENGATURAN ==================
function renderSettings() {
  const f = $("#settingsForm");
  f.whatsapp.value = S.settings.whatsapp || "";
  f.pengumuman.value = S.settings.pengumuman || "";
}
$("#settingsForm").onsubmit = async e => {
  e.preventDefault();
  const f = e.target, btn = f.querySelector("button");
  const wa = toWa(f.whatsapp.value);
  if (wa.length < 10) return toast("Nomor WhatsApp tidak valid");
  busy(btn, true);
  const { error } = await db.from("settings").upsert([{ key: "whatsapp", value: wa }, { key: "pengumuman", value: f.pengumuman.value.trim() }]);
  busy(btn, false);
  if (error) return toast("Gagal menyimpan: " + error.message);
  S.settings.whatsapp = wa; S.settings.pengumuman = f.pengumuman.value.trim(); renderSettings();
  toast("Pengaturan disimpan ✓");
};

// ================== MULAI ==================
$("#logoutBtn").onclick = async () => { await db.auth.signOut(); location.reload(); };
if (!db) {
  gate(`<h2>Supabase belum tersambung</h2><p class="muted">Isi URL dan publishable key Supabase di file <b>config.js</b>, lalu muat ulang halaman ini.</p>`);
} else {
  db.auth.onAuthStateChange((_ev, session) => setTimeout(() => onSession(session), 0));
}
