// ====== TASURA — RAKIT PC ======
const $ = s => document.querySelector(s);
const SLOTS = [
  { key: "processor", kat: "Processor", label: "Processor", icon: "🧠", wajib: true, contoh: "Intel Core i7-14700K" },
  { key: "motherboard", kat: "Motherboard", label: "Motherboard", icon: "🧩", wajib: true, contoh: "ASUS TUF B760M-Plus WiFi D4" },
  { key: "ram", kat: "RAM", label: "RAM", icon: "💾", wajib: true, qty: 4, contoh: "Kingston Fury Beast DDR5 32GB 6000MHz" },
  { key: "vga", kat: "VGA", label: "VGA / Kartu Grafis", icon: "🎮", wajib: "auto", contoh: "MSI RTX 4060 Ti Ventus 2X 8GB" },
  { key: "storage", kat: "Storage", label: "Storage (SSD/HDD)", icon: "💽", wajib: true, qty: 4, contoh: "Samsung 990 Pro 2TB" },
  { key: "psu", kat: "PSU", label: "Power Supply (PSU)", icon: "🔌", wajib: true, contoh: "Corsair RM750e 750W Gold" },
  { key: "casing", kat: "Casing", label: "Casing", icon: "🗄️", wajib: true, contoh: "Lian Li Lancool 216" },
  { key: "cooler", kat: "Cooler", label: "CPU Cooler", icon: "❄️", wajib: false, contoh: "DeepCool AK620" },
];
const FORM_RANK = { ITX: 1, MATX: 2, ATX: 3, EATX: 4 };
const formRank = f => FORM_RANK[String(f || "").toUpperCase().replace(/[^A-Z]/g, "")];
const up = s => String(s || "").trim().toUpperCase();
// build[slot] = { id, qty } untuk produk toko, atau { custom: true, nama, qty } untuk komponen request
let build = {};

// ---------- Data ----------
const byId = id => PRODUCTS.find(p => p.id === id);
const partsOf = slot => PRODUCTS.filter(p => up(p.kategori) === up(slot.kat));
const isCustom = key => !!build[key]?.custom;
const sel = key => build[key] && !build[key].custom ? byId(build[key].id) : undefined; // produk toko yang dipilih
const filled = key => isCustom(key) ? !!build[key].nama.trim() : !!sel(key);
const attr = (p, k) => (p && p.atribut ? p.atribut[k] : undefined);
const habis = p => p.stok !== undefined && p.stok <= 0;

async function loadProducts() {
  if (!db) return;
  const [prod, set] = await Promise.all([
    db.from("products").select("*").eq("aktif", true).order("urutan").order("id"),
    db.from("settings").select("key,value"),
  ]);
  if (prod.error) return console.warn("Memakai data cadangan", prod.error);
  PRODUCTS = prod.data.map(fromDbProduct);
  const wa = (set.data || []).find(r => r.key === "whatsapp");
  if (wa?.value) STORE.whatsapp = wa.value;
}

// ---------- Aturan kompatibilitas ----------
// Setiap aturan memeriksa pasangan komponen. run(get) mengembalikan:
//   null (komponen belum lengkap / data kosong), atau { level: "ok" | "warn" | "bad", text }.
const wattOf = (cpu, vga) => (Number(attr(cpu, "watt")) || 65) + (Number(attr(vga, "watt")) || 0) + 60;
const recWatt = est => Math.max(Math.ceil(est * 1.5 / 50) * 50, 400);
const RULES = [
  { keys: ["processor", "motherboard"], run: g => {
      const c = g("processor"), m = g("motherboard"), a = attr(c, "socket"), b = attr(m, "socket");
      if (!c || !m || !a || !b) return null;
      return up(a) === up(b) ? { level: "ok", text: `Socket cocok (${a})` } : { level: "bad", text: `Socket tidak cocok: processor ${a}, motherboard ${b}` };
  } },
  { keys: ["ram", "motherboard"], run: g => {
      const r = g("ram"), m = g("motherboard"), a = attr(r, "ram"), b = attr(m, "ram");
      if (!r || !m || !a || !b) return null;
      return up(a) === up(b) ? { level: "ok", text: `RAM ${a} cocok dengan motherboard` } : { level: "bad", text: `Tipe RAM tidak cocok: RAM ${a}, motherboard butuh ${b}` };
  } },
  { keys: ["motherboard", "casing"], run: g => {
      const m = g("motherboard"), c = g("casing"), a = formRank(attr(m, "form")), b = formRank(attr(c, "form"));
      if (!m || !c || !a || !b) return null;
      return a <= b ? { level: "ok", text: `Motherboard ${attr(m, "form")} muat di casing ${attr(c, "form")}` } : { level: "bad", text: `Motherboard ${attr(m, "form")} tidak muat di casing ${attr(c, "form")}` };
  } },
  { keys: ["vga", "casing"], run: g => {
      const v = g("vga"), c = g("casing"), a = Number(attr(v, "panjang")), b = Number(attr(c, "vga_maks"));
      if (!v || !c || !a || !b) return null;
      return a <= b ? { level: "ok", text: `VGA ${a}mm muat di casing (maks. ${b}mm)` } : { level: "bad", text: `VGA ${a}mm terlalu panjang untuk casing (maks. ${b}mm)` };
  } },
  { keys: ["cooler", "processor"], run: g => {
      const k = g("cooler"), c = g("processor"), list = attr(k, "socket"), so = attr(c, "socket");
      if (!k || !c || !list || !so) return null;
      return String(list).split(/[,\s/]+/).map(up).includes(up(so)) ? { level: "ok", text: `Cooler mendukung socket ${so}` } : { level: "bad", text: `Cooler tidak mendukung socket ${so}` };
  } },
  { keys: ["psu", "processor", "vga"], run: g => {
      const p = g("psu"), c = g("processor"), v = g("vga"), w = Number(attr(p, "watt"));
      if (!p || !w || (!c && !v)) return null;
      const est = wattOf(c, v), rec = recWatt(est);
      if (w < est) return { level: "bad", text: `PSU ${w}W kurang dari kebutuhan ±${est}W` };
      if (w < rec) return { level: "warn", text: `PSU ${w}W pas-pasan, disarankan minimal ${rec}W` };
      return { level: "ok", text: `Daya PSU ${w}W cukup (kebutuhan ±${est}W)` };
  } },
];
const getter = (b, key, p) => k => (k === key && p ? p : b[k] && byId(b[k].id));
// Masalah (bad/warn) untuk produk p jika dipasang di slot key
const issuesFor = (key, p, b = build) => RULES.filter(r => r.keys.includes(key)).map(r => r.run(getter(b, key, p))).filter(r => r && r.level !== "ok");
const estWatt = () => (sel("processor") || sel("vga")) ? wattOf(sel("processor"), sel("vga")) : 0;
// VGA wajib kecuali processor toko yang dipilih punya grafis bawaan (untuk processor request, dicek admin)
const isRequired = s => s.wajib === "auto" ? !(isCustom("processor") || attr(sel("processor"), "igpu") === true) : s.wajib;

function allChecks() {
  const g = getter(build), cpu = sel("processor"), vga = sel("vga") || isCustom("vga");
  const reqPower = isCustom("vga") || isCustom("processor"); // daya komponen request belum diketahui
  const list = RULES.map(r => r.run(g)).filter(Boolean).map(r => ({ status: r.level, text: r.text }))
    .map(c => reqPower && c.text.startsWith("Daya PSU") && c.status === "ok"
      ? { status: "info", text: "Daya komponen request belum diketahui — kecukupan PSU dicek admin" } : c);
  if (cpu && attr(cpu, "igpu") === false && !vga) list.push({ status: "bad", text: "Processor ini tanpa grafis bawaan, wajib pilih VGA" });
  if (cpu && attr(cpu, "igpu") === true && !vga) list.push({ status: "ok", text: "Memakai grafis bawaan processor (VGA opsional)" });
  if (isCustom("processor") && !vga) list.push({ status: "info", text: "Processor request: pastikan punya grafis bawaan, atau pilih VGA" });
  const req = SLOTS.filter(s => isCustom(s.key) && filled(s.key));
  if (req.length) list.push({ status: "req", text: `Komponen request (${req.map(s => s.kat).join(", ")}): dicarikan & dicek kecocokannya oleh admin, harga menyusul` });
  const noData = ["processor", "motherboard", "ram", "psu", "casing"].map(sel).filter(p => p && !Object.keys(p.atribut || {}).length);
  if (noData.length) list.push({ status: "warn", text: "Data kompatibilitas belum lengkap untuk: " + noData.map(p => p.nama).join(", ") + ". Konsultasikan ke admin." });
  const missing = SLOTS.filter(s => isRequired(s) && !filled(s.key)).map(s => s.label);
  if (missing.length) list.push({ status: "info", text: "Belum dipilih: " + missing.join(", ") });
  if (!list.length) list.push({ status: "info", text: "Pilih komponen untuk mulai mengecek kecocokan." });
  const order = { bad: 0, warn: 1, req: 2, info: 3, ok: 4 };
  return list.sort((a, b) => order[a.status] - order[b.status]);
}

// ---------- Simpan & bagikan ----------
const save = () => localStorage.setItem("tasura_build", JSON.stringify(build));
// Link: ?b=<JSON ringkas>  contoh {"processor":[5,1],"vga":["c","MSI RTX 4060 Ti",1]}
function buildParam() {
  const o = {};
  SLOTS.forEach(s => { const b = build[s.key]; if (!b) return; o[s.key] = b.custom ? ["c", b.nama, b.qty] : [b.id, b.qty]; });
  return encodeURIComponent(JSON.stringify(o));
}
function loadBuild() {
  const q = new URLSearchParams(location.search).get("b");
  if (q) {
    build = {};
    try {
      const o = JSON.parse(q);
      SLOTS.forEach(s => {
        const v = o[s.key]; if (!Array.isArray(v)) return;
        build[s.key] = v[0] === "c" ? { custom: true, nama: String(v[1] || "").slice(0, 150), qty: +v[2] || 1 } : { id: +v[0], qty: +v[1] || 1 };
      });
    } catch {
      q.split(",").forEach(part => { // format lama: processor-5,ram-8x2
        const m = part.match(/^(\w+)-(\d+)(?:x(\d+))?$/);
        if (m && SLOTS.some(s => s.key === m[1])) build[m[1]] = { id: +m[2], qty: +(m[3] || 1) };
      });
    }
    history.replaceState(null, "", location.pathname);
  } else build = JSON.parse(localStorage.getItem("tasura_build") || "{}");
  Object.keys(build).forEach(k => { if (!build[k].custom && !byId(build[k].id)) delete build[k]; });
  save();
}

// ---------- Tampilan ----------
const thumb = p => p.gambar ? `<img src="${esc(p.gambar)}" alt="" loading="lazy">` : esc(p.emoji || "📦");
function chips(p) {
  const a = p.atribut || {}, c = [];
  if (a.socket) c.push(a.socket.includes(",") ? a.socket.replace(/,/g, " / ") : "Socket " + a.socket);
  if (a.ram) c.push(a.ram);
  if (a.form) c.push(a.form);
  if (a.watt) c.push(a.watt + "W");
  if (a.panjang) c.push(a.panjang + "mm");
  if (a.vga_maks) c.push("VGA maks. " + a.vga_maks + "mm");
  if (a.igpu === true) c.push("Grafis bawaan");
  return c.map(x => `<span class="chip-attr">${esc(x)}</span>`).join("");
}

function optionsFor(s) {
  const cur = build[s.key];
  const items = partsOf(s).map(p => ({ p, iss: issuesFor(s.key, p) }))
    .sort((a, b) => habis(a.p) - habis(b.p) || a.iss.some(i => i.level === "bad") - b.iss.some(i => i.level === "bad") || a.p.harga - b.p.harga);
  const opt = ({ p, iss }) => {
    const bad = iss.find(i => i.level === "bad"), warn = iss.find(i => i.level === "warn");
    const mark = habis(p) ? "" : bad ? "✗ " : warn ? "⚠ " : "";
    const note = habis(p) ? " — Stok habis" : bad ? " — tidak cocok" : "";
    return `<option value="${p.id}" ${cur && !cur.custom && cur.id === p.id ? "selected" : ""} ${habis(p) && !(cur && cur.id === p.id) ? "disabled" : ""}>${mark}${esc(p.nama)} — ${rupiah(p.harga)}${note}</option>`;
  };
  return `<option value="">— Pilih ${esc(s.label)} —</option>` +
    (items.length ? `<optgroup label="Produk Tasura">${items.map(opt).join("")}</optgroup>` : "") +
    `<optgroup label="Tidak ada yang cocok?"><option value="custom" ${cur?.custom ? "selected" : ""}>✏️ Komponen lain — tulis sendiri (dicarikan admin)</option></optgroup>`;
}

function renderSlots() {
  $("#slotList").innerHTML = SLOTS.map(s => {
    const b = build[s.key], p = sel(s.key), custom = isCustom(s.key);
    const iss = p ? issuesFor(s.key, p) : [];
    const lvl = custom ? (filled(s.key) ? "req" : "") : iss.some(i => i.level === "bad") ? "bad" : iss.length ? "warn" : p ? "ok" : "";
    const req = isRequired(s) ? `<span class="tag-wajib">Wajib</span>` : `<span class="tag-opsional">Opsional</span>`;
    return `
      <div class="slot ${lvl}" data-slot="${s.key}">
        <div class="slot-icon">${p ? thumb(p) : s.icon}</div>
        <div class="slot-main">
          <div class="slot-label">${s.label} ${req}</div>
          <select class="part-select" data-select="${s.key}" aria-label="Pilih ${esc(s.label)}">${optionsFor(s)}</select>
          ${custom ? `<input class="part-custom" data-custom="${s.key}" maxlength="150" value="${esc(b.nama)}" placeholder="Tulis merek & tipe, contoh: ${esc(s.contoh)}" />
                      <div class="slot-issue req">🛠️ Dicarikan admin di toko lain. Harga & kecocokan dikonfirmasi via WhatsApp.</div>` : ""}
          ${p ? `<div class="chips-row">${chips(p)}</div>${iss.map(i => `<div class="slot-issue ${i.level}">${i.level === "bad" ? "✗" : "!"} ${esc(i.text)}</div>`).join("")}` : ""}
        </div>
        <div class="slot-side">
          ${b ? `<b>${custom ? `<span class="tbd">Harga menyusul</span>` : rupiah(p.harga * b.qty)}</b>
                 ${s.qty ? `<div class="qty"><button data-q="-1" data-k="${s.key}" aria-label="Kurangi">−</button>${b.qty}<button data-q="1" data-k="${s.key}" aria-label="Tambah">+</button></div>` : ""}
                 <button class="link danger" data-clear="${s.key}">Hapus</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

function summaryRows() {
  return SLOTS.filter(s => build[s.key] && (filled(s.key) || isCustom(s.key)))
    .map(s => ({ s, p: sel(s.key), b: build[s.key] }));
}
function renderSummary() {
  const rows = summaryRows();
  const total = rows.reduce((t, r) => t + (r.p ? r.p.harga * r.b.qty : 0), 0);
  const nReq = rows.filter(r => r.b.custom).length;
  $("#sumItems").innerHTML = rows.length ? rows.map(r => `
    <div class="sum-row ${r.b.custom ? "is-req" : ""}"><span>${r.s.icon} ${r.b.custom ? `<em>Request:</em> ${esc(r.b.nama.trim() || "(belum diisi)")}` : esc(r.p.nama)}${r.b.qty > 1 ? ` ×${r.b.qty}` : ""}</span><span>${r.b.custom ? "Menyusul" : rupiah(r.p.harga * r.b.qty)}</span></div>`).join("")
    : `<p class="muted">Belum ada komponen.</p>`;
  $("#sumLabel").textContent = nReq ? "Total sementara" : "Total";
  $("#sumTotal").textContent = rupiah(total);
  $("#sumNote").hidden = !nReq;
  $("#sumNote").textContent = `Belum termasuk ${nReq} komponen request. Harganya dikonfirmasi admin via WhatsApp.`;
  $("#mbTotal").textContent = rupiah(total) + (nReq ? " +" : "");
  const est = estWatt();
  const reqPower = isCustom("vga") || isCustom("processor");
  $("#sumWatt").innerHTML = est && !reqPower ? `⚡ Estimasi daya ±${est}W • PSU disarankan ≥ ${recWatt(est)}W` : "";
  const icons = { ok: "✓", bad: "✗", warn: "!", info: "•", req: "🛠" };
  $("#checkList").innerHTML = allChecks().map(c => `<li class="${c.status}"><span>${icons[c.status]}</span>${esc(c.text)}</li>`).join("");
  $("#waBuild").href = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(waText(rows, total))}`;
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function waText(rows, total) {
  const bad = allChecks().filter(c => c.status === "bad" || c.status === "warn");
  const line = r => r.b.custom
    ? `• ${r.s.label}: *[REQUEST]* ${r.b.nama.trim() || "-"}${r.b.qty > 1 ? ` ×${r.b.qty}` : ""} (mohon dicarikan)`
    : `• ${r.s.label}: ${r.p.nama}${r.b.qty > 1 ? ` ×${r.b.qty}` : ""} (${rupiah(r.p.harga * r.b.qty)})`;
  const nReq = rows.filter(r => r.b.custom).length;
  return `Halo *${STORE.nama}*, saya mau konsultasi rakitan PC:\n\n` +
    (rows.length ? rows.map(line).join("\n") : "(belum ada komponen)") +
    `\n\n*${nReq ? "Total sementara" : "Total"}: ${rupiah(total)}*` + (nReq ? ` + ${nReq} komponen request` : "") +
    (bad.length ? `\n\nCatatan cek kompatibilitas:\n${bad.map(c => "- " + c.text).join("\n")}` : "") +
    `\n\nLink rakitan: ${location.origin}${location.pathname}?b=${buildParam()}\n\nMohon dibantu dicek ya 🙏`;
}

function render() { $("#buildError").hidden = true; renderSlots(); renderSummary(); }

// ---------- Keranjang ----------
function addToCart() {
  const err = $("#buildError"); err.hidden = true;
  const fail = msg => { err.textContent = msg; err.hidden = false; };
  const emptyReq = SLOTS.find(s => isCustom(s.key) && !filled(s.key));
  if (emptyReq) return fail(`Tulis nama komponen request untuk ${emptyReq.label}, atau pilih dari daftar.`);
  const checks = allChecks();
  const bad = checks.find(c => c.status === "bad");
  if (bad) return fail("Perbaiki dulu: " + bad.text);
  const missing = SLOTS.filter(s => isRequired(s) && !filled(s.key));
  if (missing.length) return fail("Belum dipilih: " + missing.map(s => s.label).join(", "));
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  for (const s of SLOTS) {
    const p = sel(s.key); if (!p) continue;
    const inCart = cart.find(i => !i.custom && i.id === p.id);
    if (p.stok !== undefined && (inCart?.qty || 0) + build[s.key].qty > p.stok) return fail(`Stok ${p.nama} tidak cukup (tersisa ${p.stok}).`);
  }
  SLOTS.forEach(s => {
    const b = build[s.key]; if (!b) return;
    if (b.custom) return cart.push({ custom: true, key: "req-" + s.key + "-" + Date.now(), slot: s.kat, nama: b.nama.trim(), qty: b.qty });
    const i = cart.find(x => !x.custom && x.id === b.id);
    i ? i.qty += b.qty : cart.push({ id: b.id, qty: b.qty });
  });
  localStorage.setItem("tasura_cart", JSON.stringify(cart));
  if ($("#assemble").checked) localStorage.setItem("tasura_checkout_note", "Rakit PC: mohon komponen dirakitkan. Rakitan: " +
    SLOTS.filter(s => filled(s.key)).map(s => isCustom(s.key) ? `[Request] ${build[s.key].nama.trim()}` : sel(s.key).nama).join(", "));
  location.href = "index.html?keranjang=1";
}

// ---------- Events ----------
document.addEventListener("change", e => {
  const key = e.target.dataset.select; if (!key) return;
  const v = e.target.value, prev = build[key];
  if (!v) delete build[key];
  else if (v === "custom") build[key] = { custom: true, nama: prev?.custom ? prev.nama : "", qty: prev?.qty || 1 };
  else build[key] = { id: +v, qty: prev?.qty || 1 };
  save(); render();
  if (v === "custom") $(`[data-custom="${key}"]`)?.focus();
  else if (v) {
    const iss = issuesFor(key, byId(+v));
    if (iss.some(i => i.level === "bad")) toast("⚠️ Komponen ini tidak cocok dengan rakitanmu");
  }
});
document.addEventListener("input", e => {
  const key = e.target.dataset.custom; if (!key) return;
  build[key].nama = e.target.value; save();
  $("#buildError").hidden = true;
  e.target.closest(".slot").classList.toggle("req", !!e.target.value.trim());
  renderSummary(); // tidak render ulang daftar agar kursor tidak hilang
});
document.addEventListener("click", e => {
  const t = e.target;
  const clr = t.closest("[data-clear]"); if (clr) { delete build[clr.dataset.clear]; save(); return render(); }
  const qb = t.closest("[data-q]");
  if (qb) {
    const s = SLOTS.find(x => x.key === qb.dataset.k), b = build[s.key], p = sel(s.key);
    const n = b.qty + Number(qb.dataset.q);
    if (n < 1 || n > s.qty) return;
    if (p && p.stok !== undefined && n > p.stok) return toast(`Stok tersisa ${p.stok}`);
    b.qty = n; save(); return render();
  }
});
$("#resetBuild").onclick = () => { if (confirm("Kosongkan semua komponen?")) { build = {}; save(); render(); } };
$("#addBuild").onclick = addToCart;
$("#mbGo").onclick = () => $("#summary").scrollIntoView({ behavior: "smooth" });
$("#shareBuild").onclick = async () => {
  const url = `${location.origin}${location.pathname}?b=${buildParam()}`;
  try { await navigator.clipboard.writeText(url); toast("Link rakitan disalin ✓"); }
  catch { prompt("Salin link ini:", url); }
};
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2000);
}

(async () => { await loadProducts(); loadBuild(); render(); })();
