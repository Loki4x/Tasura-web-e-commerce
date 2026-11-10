// ====== KONFIGURASI SUPABASE ======
// Ambil dari Supabase Dashboard → Project Settings → API
// "anon public key" memang aman ditaruh di website (data dilindungi oleh Row Level Security).
const SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-KEY",
};
