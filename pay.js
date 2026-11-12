// ====== Pembayaran online Poketo (QRIS, Virtual Account, PayLater, kartu debit) ======
// Tagihan dibuat oleh Supabase Edge Function "poketo-checkout" (secret key aman di server).
// Status lunas hanya ditentukan oleh webhook "poketo-webhook", bukan oleh browser.
const Pay = (() => {
  let enabled = false;
  const fnUrl = () => SUPABASE_CONFIG.url.replace(/\/+$/, "") + "/functions/v1/" + (SUPABASE_CONFIG.poketoCheckoutFunction || "poketo-checkout");

  // Metode pembayaran Poketo (cadangan bila API belum bisa dihubungi; angka sesuai dokumentasi Poketo)
  const METHODS = [
    { code: "QRIS", name: "QRIS", icon: "▦", desc: "Scan dengan GoPay, OVO, DANA, ShopeePay, LinkAja, atau m-banking", min: 10000, max: 10000000, pct: 0.7, flat: 0, small: { upTo: 100000, flat: 1000 } },
    { code: "VA", name: "Virtual Account", icon: "🏦", desc: "Transfer lewat ATM / m-banking (BRI, BNI, Permata, dan bank lain)", min: 10000, max: 50000000, pct: 0, flat: 4000 },
    { code: "AKULAKU", name: "Akulaku PayLater", icon: "🕒", desc: "Bayar nanti atau cicil dengan Akulaku", min: 10000, max: null, pct: 1.5, flat: 2000 },
    { code: "CARD", name: "Kartu Debit Visa/Mastercard", icon: "💳", desc: "Formulir kartu dibuka di tab baru", min: 10000, max: null, pct: 2.8, flat: 2000 },
  ];
  // Perkiraan total yang dibayar pembeli: nominal + biaya dasar (0,3%, min 200, maks 1.000) + biaya metode (+PPN 11%)
  function estimate(m, amount) {
    const platform = Math.min(1000, Math.max(200, Math.round(amount * 0.003)));
    let total = (amount + platform + (m.flat || 0) * 1.11) / (1 - (m.pct || 0) / 100 * 1.11);
    if (m.small && total <= m.small.upTo) total = amount + platform + m.small.flat * 1.11;
    total = Math.ceil(total);
    return { fee: total - amount, totalAmount: total };
  }
  const cache = new Map();
  // Daftar metode + biaya untuk nominal tertentu: dari Poketo (via Edge Function), atau perkiraan
  async function methods(amount) {
    amount = Math.max(0, Math.round(amount));
    if (cache.has(amount)) return cache.get(amount);
    let live = null;
    try {
      const r = await fetch(fnUrl(), { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}` }, body: JSON.stringify({ action: "methods", amount }) });
      const d = await r.json();
      if (r.ok && Array.isArray(d.methods) && d.methods.length) live = d.methods;
    } catch { /* pakai perkiraan */ }
    const list = live
      ? live.map(x => { const base = METHODS.find(m => m.code === x.code) || { icon: "💠", desc: "" }; return { ...base, ...x, desc: x.banks?.length ? `Transfer lewat ATM / m-banking (${x.banks.slice(0, 4).join(", ")}${x.banks.length > 4 ? ", dll." : ""})` : base.desc, estimated: x.totalAmount == null, ...(x.totalAmount == null ? estimate(base, amount) : {}) }; })
      : METHODS.map(m => ({ ...m, available: true, estimated: true, ...estimate(m, amount) }));
    cache.set(amount, list);
    return list;
  }

  async function init() {
    if (!db) return false;
    const { data } = await db.from("settings").select("value").eq("key", "poketo_aktif").maybeSingle();
    enabled = data?.value === "1";
    return enabled;
  }

  function loadScript() {
    if (window.Poketo?.checkout) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://poketo.id/js/checkout.js";
      s.onload = resolve; s.onerror = () => reject(new Error("Halaman pembayaran gagal dimuat"));
      document.head.appendChild(s);
    });
  }

  async function createInvoice(orderId, hp) {
    const r = await fetch(fnUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_CONFIG.anonKey, Authorization: `Bearer ${SUPABASE_CONFIG.anonKey}` },
      body: JSON.stringify({ orderId, hp }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) throw new Error(d.error || "Gagal membuat tagihan pembayaran");
    return d;
  }

  // Buka halaman bayar Poketo sebagai pop-up. onDone("paid" | "closed")
  async function open(orderId, hp, onDone = () => {}) {
    const d = await createInvoice(orderId, hp);
    if (d.status === "paid") return onDone("paid");
    try {
      await loadScript();
      window.Poketo.checkout.open(d.paymentUrl, { onPaid: () => onDone("paid"), onClose: () => onDone("closed") });
    } catch {
      location.href = d.paymentUrl; // cadangan: pindah ke halaman bayar Poketo
    }
  }

  // Panel "Bayar Sekarang" di halaman lacak pesanan
  function mount(el, o, hp, refresh) {
    if (!el || !enabled || o.bayar_status === "lunas" || o.status === "Dibatalkan") return (el && (el.innerHTML = ""));
    const unpriced = o.items.some(i => i.custom && !i.harga);
    if (unpriced) {
      el.innerHTML = `<div class="pay-panel"><h4>💳 Bayar Online</h4><p class="muted">Pembayaran online tersedia setelah admin mengonfirmasi harga komponen request.</p></div>`;
      return;
    }
    if (!canPayOnline(o)) return (el.innerHTML = "");
    el.innerHTML = `<div class="pay-panel">
      <h4>💳 Bayar Online — ${rupiah(o.total)}</h4>
      <div class="pay-methods"><span>QRIS</span><span>Virtual Account</span><span>PayLater</span><span>Kartu Debit</span></div>
      <p class="muted">Biaya layanan pembayaran ditambahkan oleh Poketo sesuai metode yang kamu pilih. Status lunas otomatis diperbarui.</p>
      <p class="msg error" id="payError" hidden></p>
      <button class="btn btn-primary" id="payNow">${o.bayar_status === "menunggu" ? "Lanjutkan Pembayaran" : "Bayar Sekarang"}</button>
    </div>`;
    $("#payNow").onclick = async () => {
      const btn = $("#payNow"); btn.disabled = true; btn.textContent = "Menyiapkan pembayaran...";
      try {
        await open(o.id, hp, status => { if (status === "paid") toast("Pembayaran diterima, memperbarui status..."); setTimeout(refresh, status === "paid" ? 2500 : 300); });
      } catch (e) { $("#payError").textContent = e.message; $("#payError").hidden = false; }
      btn.disabled = false; btn.textContent = o.bayar_status === "menunggu" ? "Lanjutkan Pembayaran" : "Bayar Sekarang";
    };
  }

  return { init, open, mount, methods, estimate, METHODS, get enabled() { return enabled; } };
})();
