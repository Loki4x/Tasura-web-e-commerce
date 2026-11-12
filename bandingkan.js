// ====== TASURA — Bandingkan produk ======
const purl = p => `produk.html?id=${p.id}`;
const ROWS = [
  ["Harga", p => `<b>${rupiah(p.harga)}</b>${p.hargaCoret ? `<br><s class="muted">${rupiah(p.hargaCoret)}</s>` : ""}`, p => p.harga],
  ["Kategori", p => esc(p.kategori), p => p.kategori],
  ["Rating", p => `<span class="stars">★</span> ${p.rating}`, p => p.rating],
  ["Terjual", p => p.terjual, p => p.terjual],
  ["Stok", p => p.stok === undefined ? "-" : p.stok <= 0 ? `<span class="pd-stock out">Habis</span>` : p.stok, p => p.stok > 0],
  ["Socket", p => esc(p.atribut?.socket?.replace(/,/g, ", ") || "-"), p => p.atribut?.socket],
  ["Tipe RAM", p => esc(p.atribut?.ram || "-"), p => p.atribut?.ram],
  ["Form factor", p => esc(p.atribut?.form || "-"), p => p.atribut?.form],
  ["Daya", p => p.atribut?.watt ? p.atribut.watt + " W" : "-", p => p.atribut?.watt],
  ["Panjang", p => p.atribut?.panjang ? p.atribut.panjang + " mm" : "-", p => p.atribut?.panjang],
  ["VGA maks.", p => p.atribut?.vga_maks ? p.atribut.vga_maks + " mm" : "-", p => p.atribut?.vga_maks],
  ["Grafis bawaan", p => p.atribut?.igpu === undefined ? "-" : p.atribut.igpu ? "Ya" : "Tidak", p => p.atribut?.igpu],
];

function addToCart(p) {
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  const item = cart.find(i => !i.custom && i.id === p.id);
  if (p.stok !== undefined && (item?.qty || 0) + 1 > p.stok) return toast(p.stok <= 0 ? "Stok habis" : `Stok tersisa ${p.stok}`);
  item ? item.qty++ : cart.push({ id: p.id, qty: 1 });
  localStorage.setItem("tasura_cart", JSON.stringify(cart)); updateCartCount(); toast("✓ Ditambahkan ke keranjang");
}

async function load() {
  const ids = Compare.list();
  let items = [];
  if (ids.length && db) {
    const { data, error } = await db.from("products").select("*").in("id", ids);
    if (!error) items = data.map(fromDbProduct);
  }
  if (!items.length) items = PRODUCTS.filter(p => ids.includes(p.id));
  items = ids.map(id => items.find(p => p.id === id)).filter(Boolean);
  render(items);
}

function render(items) {
  const page = $("#comparePage");
  if (!items.length) {
    page.innerHTML = `<div class="empty-page"><h2>Belum ada produk untuk dibandingkan</h2><p class="muted">Klik <b>⇄ Bandingkan</b> di kartu produk atau halaman produk (maksimal ${Compare.MAX}).</p><a class="btn btn-primary" href="index.html#produk">Pilih Produk</a></div>`;
    return;
  }
  const cats = new Set(items.map(p => p.kategori));
  const rows = ROWS.filter(([label, , key]) => items.some(p => { const v = key(p); return v !== undefined && v !== null && v !== ""; }) || ["Harga", "Kategori", "Stok"].includes(label));
  const differs = key => new Set(items.map(p => JSON.stringify(key(p) ?? null))).size > 1;
  const cheapest = Math.min(...items.map(p => p.harga));
  page.innerHTML = `
    ${cats.size > 1 ? `<p class="hint">Kamu membandingkan produk dari kategori berbeda (${[...cats].map(esc).join(", ")}). Perbandingan paling berguna untuk produk sejenis.</p>` : ""}
    <div class="cmp-wrap"><table class="cmp-table">
      <thead><tr><th></th>${items.map(p => `<th>
        <div class="cmp-head"><a href="${purl(p)}" class="cmp-thumb">${p.gambar ? `<img src="${esc(p.gambar)}" alt="">` : esc(p.emoji)}</a>
        <a href="${purl(p)}" class="cmp-name">${esc(p.nama)}</a>
        ${p.harga === cheapest && items.length > 1 ? `<span class="cmp-best">Termurah</span>` : ""}
        <div class="cmp-btns"><button class="btn btn-primary sm" data-add="${p.id}" ${p.stok <= 0 ? "disabled" : ""}>+ Keranjang</button><button class="link danger" data-remove="${p.id}">Hapus</button></div></div>
      </th>`).join("")}${items.length < Compare.MAX ? `<th class="cmp-add"><a href="index.html#produk">＋ Tambah produk</a></th>` : ""}</tr></thead>
      <tbody>${rows.map(([label, fmt, key]) => `<tr class="${differs(key) ? "diff" : ""}"><th>${label}</th>${items.map(p => `<td>${fmt(p)}</td>`).join("")}${items.length < Compare.MAX ? "<td></td>" : ""}</tr>`).join("")}
        <tr><th>Spesifikasi</th>${items.map(p => `<td><ul class="cmp-spec">${(p.spek || []).map(s => `<li>${esc(s)}</li>`).join("") || "<li>-</li>"}</ul></td>`).join("")}${items.length < Compare.MAX ? "<td></td>" : ""}</tr>
      </tbody>
    </table></div>
    <button class="link danger" id="clearCompare">Kosongkan perbandingan</button>`;
  page.onclick = e => {
    const add = e.target.closest("[data-add]"); if (add) return addToCart(items.find(p => p.id === +add.dataset.add));
    const rm = e.target.closest("[data-remove]"); if (rm) { Compare.toggle(+rm.dataset.remove); load(); }
    if (e.target.id === "clearCompare") { Compare.clear(); load(); }
  };
}

(async () => { await loadSettings(); load(); })();
