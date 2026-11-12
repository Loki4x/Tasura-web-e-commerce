// ====== TASURA — RAKIT PC ======
const $ = s => document.querySelector(s);
const SLOTS = [
  { key: "processor", kat: "Processor", label: "Processor", icon: "🧠", wajib: true },
  { key: "motherboard", kat: "Motherboard", label: "Motherboard", icon: "🧩", wajib: true },
  { key: "ram", kat: "RAM", label: "RAM", icon: "💾", wajib: true, qty: 4 },
  { key: "vga", kat: "VGA", label: "VGA / Kartu Grafis", icon: "🎮", wajib: "auto" },
  { key: "storage", kat: "Storage", label: "Storage (SSD/HDD)", icon: "💽", wajib: true, qty: 4 },
  { key: "psu", kat: "PSU", label: "Power Supply (PSU)", icon: "🔌", wajib: true },
  { key: "casing", kat: "Casing", label: "Casing", icon: "🗄️", wajib: true },
  { key: "cooler", kat: "Cooler", label: "CPU Cooler", icon: "❄️", wajib: false },
];
const FORM_RANK = { ITX: 1, MATX: 2, ATX: 3, EATX: 4 };
const formRank = f => FORM_RANK[String(f || "").toUpperCase().replace(/[^A-Z]/g, "")];
const up = s => String(s || "").trim().toUpperCase();
let build = {};            // { processor: { id, qty }, ... }
let picking = null;        // slot yang sedang dipilih

// ---------- Data ----------
const byId = id => PRODUCTS.find(p => p.id === id);
const partsOf = slot => PRODUCTS.filter(p => up(p.kategori) === up(slot.kat));
const sel = key => build[key] && byId(build[key].id);
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
const isRequired = s => s.wajib === "auto" ? !(sel("processor") && attr(sel("processor"), "igpu") === true) : s.wajib;

function allChecks() {
  const g = getter(build), cpu = sel("processor"), vga = sel("vga");
  const list = RULES.map(r => r.run(g)).filter(Boolean).map(r => ({ status: r.level, text: r.text }));
  if (cpu && attr(cpu, "igpu") === false && !vga) list.push({ status: "bad", text: "Processor ini tanpa grafis bawaan, wajib pilih VGA" });
  if (cpu && attr(cpu, "igpu") === true && !vga) list.push({ status: "ok", text: "Memakai grafis bawaan processor (VGA opsional)" });
  const noData = ["processor", "motherboard", "ram", "psu", "casing"].map(sel).filter(p => p && !Object.keys(p.atribut || {}).length);
  if (noData.length) list.push({ status: "warn", text: "Data kompatibilitas belum lengkap untuk: " + noData.map(p => p.nama).join(", ") + ". Konsultasikan ke admin." });
  const missing = SLOTS.filter(s => isRequired(s) && !sel(s.key)).map(s => s.label);
  if (missing.length) list.push({ status: "info", text: "Belum dipilih: " + missing.join(", ") });
  if (!list.length) list.push({ status: "info", text: "Pilih komponen untuk mulai mengecek kecocokan." });
  const order = { bad: 0, warn: 1, info: 2, ok: 3 };
  return list.sort((a, b) => order[a.status] - order[b.status]);
}

// ---------- Simpan & bagikan ----------
const save = () => localStorage.setItem("tasura_build", JSON.stringify(build));
function buildParam() {
  return SLOTS.filter(s => build[s.key]).map(s => `${s.key}-${build[s.key].id}${build[s.key].qty > 1 ? "x" + build[s.key].qty : ""}`).join(",");
}
function loadBuild() {
  const q = new URLSearchParams(location.search).get("b");
  if (q) {
    build = {};
    q.split(",").forEach(part => {
      const m = part.match(/^(\w+)-(\d+)(?:x(\d+))?$/);
      if (m && SLOTS.some(s => s.key === m[1])) build[m[1]] = { id: +m[2], qty: +(m[3] || 1) };
    });
    history.replaceState(null, "", location.pathname);
  } else build = JSON.parse(localStorage.getItem("tasura_build") || "{}");
  Object.keys(build).forEach(k => { if (!byId(build[k].id)) delete build[k]; });
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

function renderSlots() {
  $("#slotList").innerHTML = SLOTS.map(s => {
    const p = sel(s.key), b = build[s.key];
    const iss = p ? issuesFor(s.key, p) : [];
    const lvl = iss.some(i => i.level === "bad") ? "bad" : iss.length ? "warn" : p ? "ok" : "";
    const req = isRequired(s) ? `<span class="req">Wajib</span>` : `<span class="opt">Opsional</span>`;
    if (!partsOf(s).length) return `
      <div class="slot empty-cat"><div class="slot-icon">${s.icon}</div><div class="slot-main"><div class="slot-label">${s.label} ${req}</div><p class="muted">Belum ada produk di kategori "${s.kat}".</p></div></div>`;
    return `
      <div class="slot ${lvl}" data-slot="${s.key}">
        <div class="slot-icon">${p ? thumb(p) : s.icon}</div>
        <div class="slot-main">
          <div class="slot-label">${s.label} ${req}</div>
          ${p ? `<div class="slot-name">${esc(p.nama)}</div><div class="chips-row">${chips(p)}</div>
                 ${iss.map(i => `<div class="slot-issue ${i.level}">${i.level === "bad" ? "✗" : "!"} ${esc(i.text)}</div>`).join("")}`
              : `<div class="slot-empty">Belum dipilih</div>`}
        </div>
        <div class="slot-side">
          ${p ? `<b>${rupiah(p.harga * b.qty)}</b>
                 ${s.qty ? `<div class="qty"><button data-q="-1" data-k="${s.key}">−</button>${b.qty}<button data-q="1" data-k="${s.key}">+</button></div>` : ""}
                 <div class="slot-actions"><button class="link" data-pick="${s.key}">Ganti</button><button class="link danger" data-clear="${s.key}">Hapus</button></div>`
              : `<button class="btn btn-primary sm" data-pick="${s.key}">Pilih</button>`}
        </div>
      </div>`;
  }).join("");
}

function renderSummary() {
  const rows = SLOTS.filter(s => sel(s.key)).map(s => ({ s, p: sel(s.key), qty: build[s.key].qty }));
  const total = rows.reduce((t, r) => t + r.p.harga * r.qty, 0);
  $("#sumItems").innerHTML = rows.length ? rows.map(r => `
    <div class="sum-row"><span>${r.s.icon} ${esc(r.p.nama)}${r.qty > 1 ? ` ×${r.qty}` : ""}</span><span>${rupiah(r.p.harga * r.qty)}</span></div>`).join("")
    : `<p class="muted">Belum ada komponen.</p>`;
  $("#sumTotal").textContent = rupiah(total);
  $("#mbTotal").textContent = rupiah(total);
  const est = estWatt();
  $("#sumWatt").innerHTML = est ? `⚡ Estimasi daya ±${est}W • PSU disarankan ≥ ${recWatt(est)}W` : "";
  const icons = { ok: "✓", bad: "✗", warn: "!", info: "•" };
  $("#checkList").innerHTML = allChecks().map(c => `<li class="${c.status}"><span>${icons[c.status]}</span>${esc(c.text)}</li>`).join("");
  $("#waBuild").href = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(waText(rows, total))}`;
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function waText(rows, total) {
  const bad = allChecks().filter(c => c.status === "bad" || c.status === "warn");
  return `Halo *${STORE.nama}*, saya mau konsultasi rakitan PC:\n\n` +
    (rows.length ? rows.map(r => `• ${r.s.label}: ${r.p.nama}${r.qty > 1 ? ` ×${r.qty}` : ""} (${rupiah(r.p.harga * r.qty)})`).join("\n") : "(belum ada komponen)") +
    `\n\n*Total: ${rupiah(total)}*` + (bad.length ? `\n\nCatatan cek kompatibilitas:\n${bad.map(c => "- " + c.text).join("\n")}` : "") +
    `\n\nLink rakitan: ${location.origin}${location.pathname}?b=${buildParam()}\n\nMohon dibantu dicek ya 🙏`;
}

function render() { $("#buildError").hidden = true; renderSlots(); renderSummary(); }

// ---------- Pilih komponen ----------
function openPick(key) {
  picking = SLOTS.find(s => s.key === key);
  $("#pickTitle").textContent = "Pilih " + picking.label;
  $("#pickSearch").value = "";
  renderPick();
  $("#pickModal").classList.add("show");
  setTimeout(() => $("#pickSearch").focus(), 50);
}
function renderPick() {
  const q = $("#pickSearch").value.trim().toLowerCase();
  const only = $("#onlyCompat").checked;
  let list = partsOf(picking).map(p => ({ p, iss: issuesFor(picking.key, p) }))
    .filter(x => !q || (x.p.nama + " " + JSON.stringify(x.p.atribut || {})).toLowerCase().includes(q));
  const hidden = only ? list.filter(x => x.iss.some(i => i.level === "bad")).length : 0;
  if (only) list = list.filter(x => !x.iss.some(i => i.level === "bad"));
  list.sort((a, b) => habis(a.p) - habis(b.p) || a.iss.length - b.iss.length || a.p.harga - b.p.harga);
  const cur = build[picking.key]?.id;
  $("#pickList").innerHTML = (list.length ? list.map(({ p, iss }) => {
    const bad = iss.some(i => i.level === "bad");
    return `<div class="pick-item ${cur === p.id ? "current" : ""} ${bad ? "bad" : ""} ${habis(p) ? "soldout" : ""}">
      <div class="pick-thumb">${thumb(p)}</div>
      <div class="pick-info">
        <b>${esc(p.nama)}</b>
        <div class="chips-row">${chips(p)}</div>
        ${iss.map(i => `<div class="slot-issue ${i.level}">${i.level === "bad" ? "✗" : "!"} ${esc(i.text)}</div>`).join("")}
        ${!iss.length && !habis(p) ? `<div class="slot-issue ok">✓ Cocok dengan rakitanmu</div>` : ""}
      </div>
      <div class="pick-side">
        <b>${rupiah(p.harga)}</b>${p.hargaCoret ? `<s>${rupiah(p.hargaCoret)}</s>` : ""}
        ${habis(p) ? `<span class="stock out">Stok habis</span>` : cur === p.id ? `<span class="muted">Dipilih</span>` : `<button class="btn ${bad ? "btn-ghost" : "btn-primary"} sm" data-choose="${p.id}">Pilih</button>`}
      </div>
    </div>`;
  }).join("") : `<p class="empty">Tidak ada komponen yang cocok.</p>`) +
    (hidden ? `<p class="muted center-text">${hidden} komponen disembunyikan karena tidak cocok. <button class="link" id="showAll">Tampilkan semua</button></p>` : "");
}

// ---------- Keranjang ----------
function addToCart() {
  const err = $("#buildError"); err.hidden = true;
  const checks = allChecks();
  const problem = checks.find(c => c.status === "bad") || (SLOTS.some(s => isRequired(s) && !sel(s.key)) && checks.find(c => c.status === "info"));
  if (problem) { err.textContent = problem.status === "bad" ? "Perbaiki dulu: " + problem.text : problem.text; err.hidden = false; return; }
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  for (const s of SLOTS) {
    const b = build[s.key]; if (!b) continue;
    const p = byId(b.id), inCart = cart.find(i => i.id === b.id);
    if (p.stok !== undefined && (inCart?.qty || 0) + b.qty > p.stok) { err.textContent = `Stok ${p.nama} tidak cukup (tersisa ${p.stok}).`; err.hidden = false; return; }
  }
  SLOTS.forEach(s => {
    const b = build[s.key]; if (!b) return;
    const i = cart.find(x => x.id === b.id);
    i ? i.qty += b.qty : cart.push({ id: b.id, qty: b.qty });
  });
  localStorage.setItem("tasura_cart", JSON.stringify(cart));
  if ($("#assemble").checked) localStorage.setItem("tasura_checkout_note", "Rakit PC: mohon komponen dirakitkan. Rakitan: " + SLOTS.filter(s => sel(s.key)).map(s => sel(s.key).nama).join(", "));
  location.href = "index.html?keranjang=1";
}

// ---------- Events ----------
document.addEventListener("click", e => {
  const t = e.target;
  const pick = t.closest("[data-pick]"); if (pick) return openPick(pick.dataset.pick);
  const slotEl = t.closest(".slot[data-slot]");
  if (slotEl && !t.closest("button") && !sel(slotEl.dataset.slot)) return openPick(slotEl.dataset.slot);
  const clr = t.closest("[data-clear]"); if (clr) { delete build[clr.dataset.clear]; save(); return render(); }
  const qb = t.closest("[data-q]");
  if (qb) {
    const s = SLOTS.find(x => x.key === qb.dataset.k), b = build[s.key], p = byId(b.id);
    const n = b.qty + Number(qb.dataset.q);
    if (n < 1 || n > s.qty) return;
    if (p.stok !== undefined && n > p.stok) return toast(`Stok tersisa ${p.stok}`);
    b.qty = n; save(); return render();
  }
  const ch = t.closest("[data-choose]");
  if (ch) {
    build[picking.key] = { id: +ch.dataset.choose, qty: build[picking.key]?.qty || 1 };
    save(); render(); $("#pickModal").classList.remove("show");
    const iss = issuesFor(picking.key, byId(+ch.dataset.choose));
    toast(iss.some(i => i.level === "bad") ? "⚠️ Komponen ini tidak cocok dengan rakitanmu" : "✓ " + picking.label + " dipilih");
    return;
  }
  if (t.id === "showAll") { $("#onlyCompat").checked = false; return renderPick(); }
  if (t.closest("[data-close-pick]") || t.id === "pickModal") $("#pickModal").classList.remove("show");
});
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#pickModal").classList.remove("show"); });
$("#pickSearch").oninput = renderPick;
$("#onlyCompat").onchange = renderPick;
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
