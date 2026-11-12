// ====== TASURA — RAKIT PC ======
const $ = s => document.querySelector(s);
const SLOTS = [
  { key: "processor", kat: "Processor", label: "Processor", icon: "🧠", contoh: "Intel Core i7-14700K" },
  { key: "motherboard", kat: "Motherboard", label: "Motherboard", icon: "🧩", contoh: "ASUS TUF B760M-Plus WiFi D4" },
  { key: "ram", kat: "RAM", label: "RAM", icon: "💾", qty: 4, contoh: "Kingston Fury Beast DDR5 32GB 6000MHz" },
  { key: "vga", kat: "VGA", label: "VGA / Kartu Grafis", icon: "🎮", contoh: "MSI RTX 4060 Ti Ventus 2X 8GB" },
  { key: "storage", kat: "Storage", label: "Storage (SSD/HDD)", icon: "💽", qty: 4, contoh: "Samsung 990 Pro 2TB" },
  { key: "psu", kat: "PSU", label: "Power Supply (PSU)", icon: "🔌", contoh: "Corsair RM750e 750W Gold" },
  { key: "casing", kat: "Casing", label: "Casing", icon: "🗄️", contoh: "Lian Li Lancool 216" },
  { key: "cooler", kat: "Cooler", label: "CPU Cooler", icon: "❄️", contoh: "DeepCool AK620" },
];
const FORM_RANK = { ITX: 1, MATX: 2, ATX: 3, EATX: 4 };
const formRank = f => FORM_RANK[String(f || "").toUpperCase().replace(/[^A-Z]/g, "")];
const up = s => String(s || "").trim().toUpperCase();
// build[slot] = { id, qty }               produk toko
//              { custom: true, nama, qty } komponen request (dicarikan admin)
//              { own: true, nama }         komponen milik pembeli sendiri (tidak dibeli, ikut dirakit)
// Semua slot opsional.
let build = {};

// ---------- Data ----------
const byId = id => PRODUCTS.find(p => p.id === id);
const partsOf = slot => PRODUCTS.filter(p => up(p.kategori) === up(slot.kat));
const isCustom = key => !!build[key]?.custom;
const isOwn = key => !!build[key]?.own;
const sel = key => build[key] && !build[key].custom && !build[key].own ? byId(build[key].id) : undefined; // produk toko yang dipilih
const filled = key => isOwn(key) || (isCustom(key) ? !!build[key].nama.trim() : !!sel(key));
const unknownPower = () => ["vga", "processor"].some(k => isCustom(k) || isOwn(k)); // daya belum diketahui
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

function allChecks() {
  const g = getter(build), cpu = sel("processor"), vga = sel("vga") || isCustom("vga") || isOwn("vga");
  const list = RULES.map(r => r.run(g)).filter(Boolean).map(r => ({ status: r.level, text: r.text }))
    .map(c => unknownPower() && c.text.startsWith("Daya PSU") && c.status === "ok"
      ? { status: "info", text: "Daya processor/VGA request atau milik sendiri belum diketahui — kecukupan PSU dicek admin" } : c);
  if (cpu && attr(cpu, "igpu") === false && !vga) list.push({ status: "warn", text: "Processor ini tanpa grafis bawaan: pilih VGA, atau tandai VGA \"Sudah punya sendiri\"" });
  if (cpu && attr(cpu, "igpu") === true && !vga) list.push({ status: "ok", text: "Bisa memakai grafis bawaan processor (VGA opsional)" });
  const req = SLOTS.filter(s => isCustom(s.key) && filled(s.key));
  if (req.length) list.push({ status: "req", text: `Komponen request (${req.map(s => s.kat).join(", ")}): dicarikan & dicek kecocokannya oleh admin, harga menyusul` });
  const own = SLOTS.filter(s => isOwn(s.key));
  if (own.length) list.push({ status: "own", text: `Komponen milik sendiri (${own.map(s => s.kat).join(", ")}): ikut dirakit, kecocokannya dicek admin` });
  const noData = ["processor", "motherboard", "ram", "psu", "casing"].map(sel).filter(p => p && !Object.keys(p.atribut || {}).length);
  if (noData.length) list.push({ status: "warn", text: "Data kompatibilitas belum lengkap untuk: " + noData.map(p => p.nama).join(", ") + ". Konsultasikan ke admin." });
  if (!SLOTS.some(s => build[s.key])) list.push({ status: "info", text: "Pilih komponen mana saja untuk mulai. Semua komponen opsional." });
  const order = { bad: 0, warn: 1, req: 2, own: 3, info: 4, ok: 5 };
  return list.sort((a, b) => order[a.status] - order[b.status]);
}

// ---------- Simpan & bagikan ----------
const save = () => localStorage.setItem("tasura_build", JSON.stringify(build));
// Link: ?b=<JSON ringkas>  contoh {"processor":[5,1],"vga":["c","MSI RTX 4060 Ti",1]}
function buildParam() {
  const o = {};
  SLOTS.forEach(s => { const b = build[s.key]; if (!b) return; o[s.key] = b.own ? ["o", b.nama] : b.custom ? ["c", b.nama, b.qty] : [b.id, b.qty]; });
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
        build[s.key] = v[0] === "o" ? { own: true, nama: String(v[1] || "").slice(0, 150) }
          : v[0] === "c" ? { custom: true, nama: String(v[1] || "").slice(0, 150), qty: +v[2] || 1 } : { id: +v[0], qty: +v[1] || 1 };
      });
    } catch {
      q.split(",").forEach(part => { // format lama: processor-5,ram-8x2
        const m = part.match(/^(\w+)-(\d+)(?:x(\d+))?$/);
        if (m && SLOTS.some(s => s.key === m[1])) build[m[1]] = { id: +m[2], qty: +(m[3] || 1) };
      });
    }
    history.replaceState(null, "", location.pathname);
  } else build = JSON.parse(localStorage.getItem("tasura_build") || "{}");
  Object.keys(build).forEach(k => { if (!build[k].custom && !build[k].own && !byId(build[k].id)) delete build[k]; });
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

// Daftar pilihan: hanya produk yang cocok dengan komponen lain yang sudah dipilih.
// Produk yang sedang dipilih tetap tampil walau jadi tidak cocok (agar konfliknya terlihat).
function optionsFor(s) {
  const cur = build[s.key];
  const isCur = p => cur && !cur.custom && !cur.own && cur.id === p.id;
  const bad = (p, b) => issuesFor(s.key, p, b).some(i => i.level === "bad");
  const all = partsOf(s);
  const shown = all.filter(p => isCur(p) || !bad(p, build))
    .sort((a, b) => habis(a) - habis(b) || a.harga - b.harga);
  const hidden = all.filter(p => !shown.includes(p));
  // komponen terpilih yang membuat produk disembunyikan
  const blockers = SLOTS.filter(o => o.key !== s.key && sel(o.key) &&
    hidden.some(p => bad(p, { [o.key]: build[o.key] }))).map(o => o.label);
  const opt = p => {
    const iss = issuesFor(s.key, p), isBad = iss.some(i => i.level === "bad"), warn = iss.some(i => i.level === "warn");
    const mark = isBad ? "✗ " : warn ? "⚠ " : "";
    const note = habis(p) ? " — Stok habis" : isBad ? " — tidak cocok" : "";
    return `<option value="${p.id}" ${isCur(p) ? "selected" : ""} ${habis(p) && !isCur(p) ? "disabled" : ""}>${mark}${esc(p.nama)} — ${rupiah(p.harga)}${note}</option>`;
  };
  const html = `<option value="">— Kosongkan / tidak perlu —</option>` +
    (shown.length ? `<optgroup label="Produk Tasura yang cocok (${shown.length})">${shown.map(opt).join("")}</optgroup>` : "") +
    `<optgroup label="Lainnya">
      <option value="custom" ${cur?.custom ? "selected" : ""}>✏️ Request komponen lain (dicarikan admin)</option>
      <option value="own" ${cur?.own ? "selected" : ""}>🏠 Sudah punya sendiri (pakai komponen saya)</option>
    </optgroup>`;
  return { html, hidden: hidden.length, blockers, total: all.length };
}

function renderSlots() {
  $("#slotList").innerHTML = SLOTS.map(s => {
    const b = build[s.key], p = sel(s.key), custom = isCustom(s.key), own = isOwn(s.key);
    const iss = p ? issuesFor(s.key, p) : [];
    const lvl = own ? "own" : custom ? (filled(s.key) ? "req" : "") : iss.some(i => i.level === "bad") ? "bad" : iss.length ? "warn" : p ? "ok" : "";
    const o = optionsFor(s);
    const hint = o.hidden ? `<div class="hide-hint">${o.hidden} produk disembunyikan karena tidak cocok${o.blockers.length ? ` dengan ${esc(o.blockers.join(" & "))} yang kamu pilih` : ""}.</div>`
      : !o.total ? `<div class="hide-hint">Belum ada produk ${esc(s.kat)} di toko. Kamu tetap bisa request atau pakai milik sendiri.</div>` : "";
    return `
      <div class="slot ${lvl}" data-slot="${s.key}">
        <div class="slot-icon">${p ? thumb(p) : own ? "🏠" : s.icon}</div>
        <div class="slot-main">
          <div class="slot-label">${s.label}</div>
          <select class="part-select" data-select="${s.key}" aria-label="Pilih ${esc(s.label)}">${o.html}</select>
          ${hint}
          ${custom ? `<input class="part-custom" data-custom="${s.key}" maxlength="150" value="${esc(b.nama)}" placeholder="Tulis merek & tipe, contoh: ${esc(s.contoh)}" />
                      <div class="slot-issue req">🛠️ Dicarikan admin di toko lain. Harga & kecocokan dikonfirmasi via WhatsApp.</div>` : ""}
          ${own ? `<input class="part-custom own" data-custom="${s.key}" maxlength="150" value="${esc(b.nama)}" placeholder="Komponen yang kamu punya (opsional), contoh: ${esc(s.contoh)}" />
                   <div class="slot-issue own">🏠 Tidak dibeli & tidak dihitung di total. Kirim/bawa komponennya agar ikut dirakit.</div>` : ""}
          ${p ? `<div class="chips-row">${chips(p)}</div>${iss.map(i => `<div class="slot-issue ${i.level}">${i.level === "bad" ? "✗" : "!"} ${esc(i.text)}</div>`).join("")}` : ""}
        </div>
        <div class="slot-side">
          ${b ? `<b>${own ? `<span class="owned">Milik sendiri</span>` : custom ? `<span class="tbd">Harga menyusul</span>` : rupiah(p.harga * b.qty)}</b>
                 ${s.qty && !own ? `<div class="qty"><button data-q="-1" data-k="${s.key}" aria-label="Kurangi">−</button>${b.qty}<button data-q="1" data-k="${s.key}" aria-label="Tambah">+</button></div>` : ""}
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
    <div class="sum-row ${r.b.custom ? "is-req" : r.b.own ? "is-own" : ""}"><span>${r.s.icon} ${r.b.own ? `<em>Milik sendiri:</em> ${esc(r.b.nama.trim() || r.s.kat)}` : r.b.custom ? `<em>Request:</em> ${esc(r.b.nama.trim() || "(belum diisi)")}` : esc(r.p.nama)}${r.b.qty > 1 && !r.b.own ? ` ×${r.b.qty}` : ""}</span><span>${r.b.own ? "—" : r.b.custom ? "Menyusul" : rupiah(r.p.harga * r.b.qty)}</span></div>`).join("")
    : `<p class="muted">Belum ada komponen.</p>`;
  $("#sumLabel").textContent = nReq ? "Total sementara" : "Total";
  $("#sumTotal").textContent = rupiah(total);
  $("#sumNote").hidden = !nReq;
  $("#sumNote").textContent = `Belum termasuk ${nReq} komponen request. Harganya dikonfirmasi admin via WhatsApp.`;
  $("#mbTotal").textContent = rupiah(total) + (nReq ? " +" : "");
  const est = estWatt();
  $("#sumWatt").innerHTML = est && !unknownPower() ? `⚡ Estimasi daya ±${est}W • PSU disarankan ≥ ${recWatt(est)}W` : "";
  const icons = { ok: "✓", bad: "✗", warn: "!", info: "•", req: "🛠", own: "🏠" };
  $("#checkList").innerHTML = allChecks().map(c => `<li class="${c.status}"><span>${icons[c.status]}</span>${esc(c.text)}</li>`).join("");
  $("#waBuild").href = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(waText(rows, total))}`;
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function waText(rows, total) {
  const bad = allChecks().filter(c => c.status === "bad" || c.status === "warn");
  const line = r => r.b.own ? `• ${r.s.label}: *[MILIK SENDIRI]* ${r.b.nama.trim() || "-"} (ikut dirakit)`
    : r.b.custom
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
  if (!SLOTS.some(s => sel(s.key) || isCustom(s.key)))
    return fail(SLOTS.some(s => isOwn(s.key)) ? "Pilih minimal satu komponen untuk dibeli atau di-request. Komponen milik sendiri tidak masuk keranjang." : "Pilih minimal satu komponen dulu.");
  const cart = JSON.parse(localStorage.getItem("tasura_cart") || "[]");
  for (const s of SLOTS) {
    const p = sel(s.key); if (!p) continue;
    const inCart = cart.find(i => !i.custom && i.id === p.id);
    if (p.stok !== undefined && (inCart?.qty || 0) + build[s.key].qty > p.stok) return fail(`Stok ${p.nama} tidak cukup (tersisa ${p.stok}).`);
  }
  SLOTS.forEach(s => {
    const b = build[s.key]; if (!b || b.own) return;
    if (b.custom) return cart.push({ custom: true, key: "req-" + s.key + "-" + Date.now(), slot: s.kat, nama: b.nama.trim(), qty: b.qty });
    const i = cart.find(x => !x.custom && x.id === b.id);
    i ? i.qty += b.qty : cart.push({ id: b.id, qty: b.qty });
  });
  localStorage.setItem("tasura_cart", JSON.stringify(cart));
  const ownList = SLOTS.filter(s => isOwn(s.key)).map(s => `${s.kat}${build[s.key].nama.trim() ? " (" + build[s.key].nama.trim() + ")" : ""}`);
  const note = [
    $("#assemble").checked ? "Rakit PC: mohon komponen dirakitkan. Rakitan: " +
      SLOTS.filter(s => filled(s.key) && !isOwn(s.key)).map(s => isCustom(s.key) ? `[Request] ${build[s.key].nama.trim()}` : sel(s.key).nama).join(", ") : "",
    ownList.length ? "Komponen milik sendiri yang ikut dirakit: " + ownList.join(", ") : "",
  ].filter(Boolean).join(". ");
  if (note) localStorage.setItem("tasura_checkout_note", note.slice(0, 500)); else localStorage.removeItem("tasura_checkout_note");
  location.href = "index.html?keranjang=1";
}

// ---------- Events ----------
document.addEventListener("change", e => {
  const key = e.target.dataset.select; if (!key) return;
  const v = e.target.value, prev = build[key];
  if (!v) delete build[key];
  else if (v === "custom") build[key] = { custom: true, nama: prev?.custom || prev?.own ? prev.nama : "", qty: prev?.qty || 1 };
  else if (v === "own") build[key] = { own: true, nama: prev?.custom || prev?.own ? prev.nama : "" };
  else build[key] = { id: +v, qty: prev?.qty || 1 };
  save(); render();
  if (v === "custom" || v === "own") $(`[data-custom="${key}"]`)?.focus();
  else if (v) {
    const iss = issuesFor(key, byId(+v));
    if (iss.some(i => i.level === "bad")) toast("⚠️ Komponen ini tidak cocok dengan rakitanmu");
  }
});
document.addEventListener("input", e => {
  const key = e.target.dataset.custom; if (!key) return;
  build[key].nama = e.target.value; save();
  $("#buildError").hidden = true;
  if (isCustom(key)) e.target.closest(".slot").classList.toggle("req", !!e.target.value.trim());
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

// ---------- Rakitan rekomendasi ----------
// Cadangan jika tabel build_presets belum ada (komponen dicari berdasarkan nama produk)
const FALLBACK_PRESETS = [
  { nama: "Gaming 1080p", label: "Gaming", deskripsi: "Main game AAA lancar di 1080p ultra. Pilihan paling seimbang untuk gamer.",
    parts: { processor: "AMD Ryzen 5 7500F", motherboard: "Motherboard B650M WiFi", ram: "RAM DDR5 16GB (2×8GB) 5600MHz", vga: "VGA GeForce RTX 4060 8GB", storage: "SSD NVMe M.2 1TB Gen4", psu: "PSU 650W 80+ Bronze", casing: "Casing mATX Tempered Glass ARGB" } },
  { nama: "Gaming & Streaming 1440p", label: "Gaming", deskripsi: "Rata kanan di 1440p, kuat untuk streaming dan editing video.",
    parts: { processor: "AMD Ryzen 7 7700", motherboard: "Motherboard X670E ATX WiFi", ram: "RAM DDR5 32GB (2×16GB) 6000MHz", vga: "VGA GeForce RTX 4070 Super 12GB", storage: "SSD NVMe M.2 1TB Gen4", psu: "PSU 850W 80+ Gold Full Modular", casing: "Casing ATX Mid Tower Airflow", cooler: "CPU Cooler Tower 4 Heatpipe ARGB" } },
  { nama: "Kantor & Sekolah", label: "Kantor", deskripsi: "Hemat, senyap, dan cepat untuk Office, browsing, dan meeting online. Tanpa VGA.",
    parts: { processor: "Intel Core i5-13400", motherboard: "Motherboard B760M DDR4", ram: "RAM DDR4 16GB (2×8GB) 3200MHz", storage: "SSD NVMe M.2 512GB Gen3", psu: "PSU 650W 80+ Bronze", casing: "Casing mATX Tempered Glass ARGB" } },
];
let presets = [];
async function loadPresets() {
  if (db) {
    const { data, error } = await db.from("build_presets").select("*").eq("aktif", true).order("urutan").order("id");
    if (!error) { presets = data || []; return; }
  }
  presets = FALLBACK_PRESETS.map(p => ({ ...p, komponen: Object.fromEntries(Object.entries(p.parts)
    .map(([k, nama]) => [k, PRODUCTS.find(x => x.nama === nama)]).filter(([, x]) => x).map(([k, x]) => [k, [x.id, 1]])) }));
}
// Komponen preset yang masih dijual
const presetParts = pr => SLOTS.filter(s => Array.isArray(pr.komponen?.[s.key]) && byId(+pr.komponen[s.key][0]))
  .map(s => ({ s, p: byId(+pr.komponen[s.key][0]), qty: +pr.komponen[s.key][1] || 1 }));
function renderPresets() {
  const list = presets.map(pr => ({ pr, parts: presetParts(pr) })).filter(x => x.parts.length);
  $("#presetsWrap").hidden = !list.length;
  $("#presetList").innerHTML = list.map(({ pr, parts }, i) => {
    const total = parts.reduce((t, x) => t + x.p.harga * x.qty, 0);
    const out = parts.filter(x => habis(x.p));
    return `<article class="preset">
      ${pr.label ? `<span class="preset-label">${esc(pr.label)}</span>` : ""}
      <h3>${esc(pr.nama)}</h3>
      <p class="muted">${esc(pr.deskripsi || "")}</p>
      <ul>${parts.map(x => `<li><span>${x.s.icon}</span>${esc(x.p.nama)}${x.qty > 1 ? ` ×${x.qty}` : ""}</li>`).join("")}</ul>
      ${out.length ? `<p class="preset-warn">Stok habis: ${out.map(x => esc(x.p.nama)).join(", ")}</p>` : ""}
      <div class="preset-foot"><div><small class="muted">Mulai dari</small><b>${rupiah(total)}</b></div>
        <button class="btn btn-primary sm" data-preset="${i}">Pakai Rakitan Ini</button></div>
    </article>`;
  }).join("");
  $("#presetList").onclick = e => {
    const b = e.target.closest("[data-preset]"); if (!b) return;
    const { pr, parts } = list[+b.dataset.preset];
    if (Object.keys(build).length && !confirm(`Ganti rakitanmu saat ini dengan "${pr.nama}"?`)) return;
    build = {};
    parts.forEach(x => { build[x.s.key] = { id: x.p.id, qty: x.qty }; });
    save(); render();
    toast(`✓ Rakitan "${pr.nama}" dipakai. Silakan ubah komponennya jika perlu.`);
    $(".builder").scrollIntoView({ behavior: "smooth" });
  };
}

(async () => { await loadProducts(); await loadPresets(); loadBuild(); render(); renderPresets(); })();
