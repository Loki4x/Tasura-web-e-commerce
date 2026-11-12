// ====== KONFIGURASI SUPABASE ======
// Ambil dari Supabase Dashboard → Project Settings → API
// "anon public key" memang aman ditaruh di website (data dilindungi oleh Row Level Security).
const SUPABASE_CONFIG = {
  url: "https://sxvopewmacnflnnqvbsd.supabase.co",
  anonKey: "sb_publishable_p8gheBOWpwXg1YMiQp0x2g_t6leHqR_",
  // Alamat (slug) Edge Function pembuat tagihan Poketo, lihat kolom URL di Supabase → Edge Functions.
  // Contoh: URL ".../functions/v1/dynamic-api" → isi "dynamic-api".
  poketoCheckoutFunction: "dynamic-api",
};
