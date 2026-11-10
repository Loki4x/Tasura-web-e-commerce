// ====== AKUN & LOGIN (Supabase) ======
const Auth = (() => {
  const configured = window.supabase && SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes("YOUR-PROJECT");
  const db = configured ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey) : null;
  const siteUrl = location.origin + location.pathname;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const state = { user: null, profile: null };
  let mode = "login";

  // ---------- UI helpers ----------
  function msg(text, type = "error") {
    const el = $("#authMsg");
    el.textContent = text; el.className = "msg " + type; el.hidden = !text;
  }
  function busy(btn, on) { btn.disabled = on; btn.dataset.label ??= btn.textContent; btn.textContent = on ? "Memproses..." : btn.dataset.label; }
  const translate = m => ({
    "Invalid login credentials": "Email atau password salah.",
    "Email not confirmed": "Email belum dikonfirmasi. Cek inbox kamu.",
    "User already registered": "Email sudah terdaftar. Silakan masuk.",
  }[m] || m);

  function setMode(m) {
    mode = m; msg("");
    const titles = { login: "Masuk ke Tasura", register: "Buat Akun Baru", forgot: "Lupa Password", newpass: "Buat Password Baru" };
    $("#authTitle").textContent = titles[m];
    $("#authTabs").hidden = !["login", "register"].includes(m);
    document.querySelectorAll("#authTabs button").forEach(b => b.classList.toggle("active", b.dataset.mode === m));
    $("#fNama").hidden = m !== "register";
    $("#fEmail").hidden = m === "newpass";
    $("#fPass").hidden = m === "forgot";
    $("#forgotLink").hidden = m !== "login";
    $("#backLink").hidden = !["forgot"].includes(m);
    $("#googleWrap").hidden = !["login", "register"].includes(m);
    $("#authSubmit").textContent = $("#authSubmit").dataset.label =
      { login: "Masuk", register: "Daftar", forgot: "Kirim Link Reset", newpass: "Simpan Password" }[m];
    const f = $("#authForm");
    f.nama.required = m === "register";
    f.email.required = m !== "newpass";
    f.password.required = m !== "forgot";
    f.password.autocomplete = m === "login" ? "current-password" : "new-password";
  }

  function openAuth(m = "login") {
    setMode(m);
    $("#authModal").classList.add("show");
    if (!db) msg("Login belum aktif: isi URL & anon key Supabase di config.js (lihat README).", "info");
  }
  const closeAuth = () => $("#authModal").classList.remove("show");

  const GOOGLE_ICON = `<svg viewBox="0 0 48 48" class="g"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
  function renderAccountBtn() {
    const btn = $("#accountBtn");
    btn.classList.toggle("logged", !!state.user);
    if (state.user) {
      const name = state.profile?.nama || state.user.email;
      const avatar = state.profile?.avatar_url || state.user.user_metadata?.avatar_url;
      btn.innerHTML = avatar ? `<img src="${esc(avatar)}" alt="" referrerpolicy="no-referrer">` : `<span class="initial">${esc(name[0].toUpperCase())}</span>`;
      btn.title = name;
    } else {
      btn.innerHTML = `${GOOGLE_ICON}<span class="lbl">Masuk</span>`;
      btn.title = "Masuk / Daftar";
    }
  }

  // ---------- Data ----------
  async function loadProfile() {
    if (!state.user) { state.profile = null; return; }
    const { data } = await db.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
    state.profile = data || { id: state.user.id, nama: state.user.user_metadata?.full_name || "" };
  }

  async function saveOrder(order) {
    if (!db || !state.user) return null;
    const { data, error } = await db.from("orders").insert(order).select("id").single();
    if (error) { console.error(error); return null; }
    // simpan data pengiriman ke profil agar checkout berikutnya otomatis terisi
    await db.from("profiles").upsert({ id: state.user.id, nama: order.nama, hp: order.hp, alamat: order.alamat, updated_at: new Date().toISOString() });
    Object.assign(state.profile, { nama: order.nama, hp: order.hp, alamat: order.alamat });
    return data.id;
  }

  function prefill(form) {
    if (!state.profile) return;
    ["nama", "hp", "alamat"].forEach(k => { if (!form[k].value && state.profile[k]) form[k].value = state.profile[k]; });
  }

  // ---------- Account modal ----------
  function openAccount(tab = "profil") {
    $("#accEmail").textContent = state.user.email;
    const f = $("#profileForm");
    f.nama.value = state.profile?.nama || "";
    f.hp.value = state.profile?.hp || "";
    f.alamat.value = state.profile?.alamat || "";
    switchTab(tab);
    $("#accountModal").classList.add("show");
  }
  function switchTab(tab) {
    document.querySelectorAll("#accTabs button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $("#profileForm").hidden = tab !== "profil";
    $("#ordersList").hidden = tab !== "pesanan";
    if (tab === "pesanan") loadOrders();
  }
  async function loadOrders() {
    const box = $("#ordersList");
    box.innerHTML = `<p class="muted">Memuat pesanan...</p>`;
    const { data, error } = await db.from("orders").select("*").order("created_at", { ascending: false });
    if (error) { box.innerHTML = `<p class="msg error">Gagal memuat pesanan.</p>`; return; }
    if (!data.length) { box.innerHTML = `<div class="cart-empty">📦<br/>Belum ada pesanan</div>`; return; }
    const rp = n => "Rp" + n.toLocaleString("id-ID");
    box.innerHTML = data.map(o => `
      <div class="order">
        <div class="row"><b>#TSR-${o.id}</b><span class="status s-${esc(o.status.split(" ")[0].toLowerCase())}">${esc(o.status)}</span></div>
        <span class="muted">${new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} • ${esc(o.pembayaran)}</span>
        <ul>${o.items.map(i => `<li>${esc(i.nama)} ×${i.qty}<span>${rp(i.harga * i.qty)}</span></li>`).join("")}</ul>
        <div class="row"><span>Total</span><b>${rp(o.total)}</b></div>
      </div>`).join("");
  }

  // ---------- Events ----------
  function bind() {
    $("#accountBtn").onclick = () => state.user ? openAccount() : openAuth();
    $("#closeAuth").onclick = closeAuth;
    $("#closeAccount").onclick = () => $("#accountModal").classList.remove("show");
    ["#authModal", "#accountModal"].forEach(id =>
      $(id).addEventListener("click", e => { if (e.target.id === id.slice(1)) e.target.classList.remove("show"); }));
    document.querySelectorAll("#authTabs button").forEach(b => b.onclick = () => setMode(b.dataset.mode));
    document.querySelectorAll("#accTabs button").forEach(b => b.onclick = () => switchTab(b.dataset.tab));
    $("#forgotLink").onclick = e => { e.preventDefault(); setMode("forgot"); };
    $("#backLink").onclick = e => { e.preventDefault(); setMode("login"); };

    $("#googleBtn").onclick = async () => {
      if (!db) return;
      const { error } = await db.auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteUrl } });
      if (error) msg(translate(error.message));
    };

    $("#authForm").onsubmit = async e => {
      e.preventDefault();
      if (!db) return;
      const f = e.target, btn = $("#authSubmit");
      const email = f.email.value.trim(), password = f.password.value;
      busy(btn, true); msg("");
      try {
        if (mode === "login") {
          const { error } = await db.auth.signInWithPassword({ email, password });
          if (error) throw error;
          closeAuth(); toast("Selamat datang kembali! 👋");
        } else if (mode === "register") {
          if (password.length < 6) throw new Error("Password minimal 6 karakter.");
          const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name: f.nama.value.trim() }, emailRedirectTo: siteUrl } });
          if (error) throw error;
          if (data.session) { closeAuth(); toast("Akun berhasil dibuat 🎉"); }
          else msg("Akun dibuat! Cek email kamu untuk konfirmasi, lalu masuk.", "success");
        } else if (mode === "forgot") {
          const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: siteUrl });
          if (error) throw error;
          msg("Link reset password sudah dikirim ke email kamu.", "success");
        } else if (mode === "newpass") {
          if (password.length < 6) throw new Error("Password minimal 6 karakter.");
          const { error } = await db.auth.updateUser({ password });
          if (error) throw error;
          closeAuth(); toast("Password berhasil diubah ✓");
        }
        f.password.value = "";
      } catch (err) { msg(translate(err.message)); }
      finally { busy(btn, false); }
    };

    $("#profileForm").onsubmit = async e => {
      e.preventDefault();
      const f = e.target, btn = f.querySelector("button[type=submit]");
      busy(btn, true);
      const upd = { id: state.user.id, nama: f.nama.value.trim(), hp: f.hp.value.trim(), alamat: f.alamat.value.trim(), updated_at: new Date().toISOString() };
      const { error } = await db.from("profiles").upsert(upd);
      busy(btn, false);
      if (error) return toast("Gagal menyimpan profil");
      Object.assign(state.profile, upd); renderAccountBtn(); toast("Profil disimpan ✓");
    };

    $("#logoutBtn").onclick = async () => {
      await db.auth.signOut();
      $("#accountModal").classList.remove("show");
      toast("Kamu sudah keluar");
    };
  }

  async function init() {
    bind(); renderAccountBtn();
    if (!db) return;
    db.auth.onAuthStateChange((event, session) => {
      state.user = session?.user || null;
      // jalankan di luar callback agar tidak deadlock dengan client Supabase
      setTimeout(async () => {
        await loadProfile(); renderAccountBtn();
        if (event === "PASSWORD_RECOVERY") openAuth("newpass");
      }, 0);
    });
  }

  init();
  return { state, saveOrder, prefill, openAuth, get loggedIn() { return !!state.user; } };
})();
