// ====== Pembayaran online Poketo (QRIS, Virtual Account, PayLater, kartu debit) ======
// Tagihan dibuat oleh Supabase Edge Function "poketo-checkout" (secret key aman di server).
// Status lunas hanya ditentukan oleh webhook "poketo-webhook", bukan oleh browser.
const Pay = (() => {
  let enabled = false;
  const fnUrl = () => SUPABASE_CONFIG.url.replace(/\/+$/, "") + "/functions/v1/poketo-checkout";

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

  return { init, open, mount, get enabled() { return enabled; } };
})();
