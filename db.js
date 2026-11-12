// Klien Supabase bersama (dipakai toko, akun, dan dashboard admin)
const db = (window.supabase && typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.url && !SUPABASE_CONFIG.url.includes("YOUR-PROJECT"))
  ? window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
  : null;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rupiah = n => "Rp" + Number(n || 0).toLocaleString("id-ID");
// Ubah baris tabel products (Supabase) ke bentuk yang dipakai website
const fromDbProduct = r => ({
  id: r.id, nama: r.nama, kategori: r.kategori, harga: r.harga, hargaCoret: r.harga_coret || 0,
  stok: r.stok, rating: Number(r.rating), terjual: r.terjual, emoji: r.emoji || "📦",
  gambar: r.gambar || "", deskripsi: r.deskripsi || "", spek: r.spek || [], aktif: r.aktif, atribut: r.atribut || {},
});
