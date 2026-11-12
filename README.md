# Tasura — Web E-Commerce

Website toko online statis (HTML, CSS, JavaScript). Tidak perlu server atau database.

## Fitur
- Landing page: hero slider, Paling Populer, Kualitas, Cara Pemesanan, testimoni, FAQ, banner ajakan belanja
- Katalog produk, pencarian, filter kategori, urutkan harga/rating
- Keranjang belanja & checkout via WhatsApp, kode promo
- **Akun pelanggan** (Supabase): daftar/masuk dengan email atau Google, lupa password,
  profil (alamat tersimpan & otomatis terisi saat checkout), riwayat & status pesanan

## Rakit PC (`/rakit.html`)
Pembeli memilih Processor, Motherboard, RAM, VGA, Storage, PSU, Casing, dan Cooler.
Kecocokan dicek otomatis: socket CPU–motherboard, tipe RAM DDR4/DDR5, ukuran motherboard–casing,
panjang VGA–casing, socket cooler, dan daya PSU. Rakitan bisa dimasukkan ke keranjang,
dikonsultasikan via WhatsApp, atau dibagikan lewat link.

- Jalankan `supabase/003_rakit_pc.sql` (setelah `002_admin.sql`) untuk menambah data kompatibilitas
  dan komponen contoh.
- Daftar tiap komponen hanya menampilkan produk yang **cocok** dengan komponen lain yang sudah dipilih;
  produk yang disembunyikan muncul lagi saat pilihan lain diganti/dikosongkan.
- Semua komponen **opsional**. Pembeli bisa menandai **"Sudah punya sendiri"** untuk komponen miliknya
  (tidak masuk keranjang, dicatat di catatan pesanan agar ikut dirakit).
- Setiap komponen dipilih dari daftar produk toko, atau pilih **"Komponen lain — tulis sendiri"** untuk
  me-request komponen yang tidak dijual. Request masuk ke pesanan dengan harga *menyusul*; admin
  mencarikannya (ada tombol cari di Tokopedia/Shopee/Google), mengisi harganya di Dashboard → Pesanan,
  lalu mengabari pelanggan via WhatsApp. Jalankan `supabase/004_request_komponen.sql` untuk fitur ini.
- Kategori produk yang dipakai: **Processor, Motherboard, RAM, VGA, Storage, PSU, Casing, Cooler**
  (penulisan harus sama).
- Data kompatibilitas diisi di Dashboard Admin → Produk → Edit → **Kompatibilitas Rakit PC**.

## Dashboard Admin (`/admin.html`)
- **Ringkasan**: pendapatan bulan ini, pesanan yang perlu dikonfirmasi/dikirim, stok menipis
- **Pesanan**: semua pesanan (termasuk tamu), ubah status, isi no. resi, catatan internal,
  chat pelanggan via WhatsApp. Status *Dibatalkan* otomatis mengembalikan stok & kuota kupon.
  Ada notifikasi otomatis saat pesanan baru masuk.
- **Produk**: tambah/edit/hapus, upload foto, stok, harga coret, spesifikasi, aktif/nonaktif
- **Kupon Diskon**: persen atau nominal, maks. potongan, min. belanja, kuota, tanggal berakhir
- **Pelanggan**: daftar akun, jumlah pesanan, total belanja
- **Pengaturan**: nomor WhatsApp toko & teks pengumuman

### Mengaktifkan dashboard admin
1. Supabase → **SQL Editor → New query** → tempel isi `supabase/002_admin.sql` → **Run**
   (jalankan setelah `schema.sql`; produk contoh & kupon `TASURA10` ikut dibuat).
2. Login sekali ke website dengan akun yang akan jadi admin.
3. Jalankan di SQL Editor (ganti email):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-kamu@gmail.com'
   on conflict do nothing;
   ```
4. Buka `https://tasura-web.vercel.app/admin.html`.

Setelah ini produk, harga, stok, kupon, dan nomor WhatsApp dikelola dari dashboard
(bukan lagi dari `products.js`, yang kini hanya data cadangan).

## Cara menjalankan
Buka `index.html` di browser.

## Cara mengubah
- **Produk, kupon, nomor WhatsApp**: lewat Dashboard Admin (lihat di atas)
- **Foto produk**: simpan foto ke folder `img/`, lalu isi `gambar: "img/namafile.jpg"`
- **Teks landing page** (hero, FAQ, testimoni, alamat di footer): edit langsung di `index.html`
- **Produk Paling Populer**: otomatis 4 produk dengan `terjual` terbanyak
- **Warna tema**: edit variabel `--primary` dan `--accent` di `style.css`

## Online gratis
Upload folder ini ke Netlify Drop (app.netlify.com/drop), Vercel, atau GitHub Pages.

## Mengaktifkan Login & Database (Supabase)

### 1. Buat project Supabase
1. Daftar gratis di https://supabase.com → **New project** (pilih region *Southeast Asia (Singapore)*).
2. Buka **SQL Editor → New query**, salin seluruh isi `supabase/schema.sql`, lalu klik **Run**.
3. Buka **Project Settings → API**, salin **Project URL** dan **anon public key**
   ke file `config.js`.

### 2. Atur alamat website
Di **Authentication → URL Configuration**:
- **Site URL**: `https://loki4x.github.io/Tasura-web-e-commerce/`
- **Redirect URLs**: tambahkan juga URL di atas (dan `http://localhost:5500/` jika testing lokal)

### 3. Login dengan Google
1. Buka https://console.cloud.google.com → buat project baru.
2. **APIs & Services → OAuth consent screen** → pilih *External*, isi nama aplikasi "Tasura" & email.
3. **Credentials → Create Credentials → OAuth client ID** → tipe *Web application*.
   - **Authorized JavaScript origins**: `https://loki4x.github.io`
   - **Authorized redirect URIs**: `https://<PROJECT-ID>.supabase.co/auth/v1/callback`
     (salin persis dari Supabase → Authentication → Providers → Google)
4. Salin **Client ID** & **Client Secret** ke Supabase → **Authentication → Providers → Google** → aktifkan → Save.

### 4. Mengelola pesanan (admin)
Pesanan pelanggan yang login tersimpan di **Table Editor → orders**.
Ubah kolom `status` menjadi `Diproses`, `Dikirim`, `Selesai`, atau `Dibatalkan`;
pelanggan akan melihat statusnya di menu **Akun Saya → Pesanan Saya**.

> Catatan: login harus dicoba lewat `http://` / `https://` (GitHub Pages atau server lokal seperti
> VS Code Live Server), bukan dengan membuka file `index.html` langsung (`file://`), terutama untuk login Google.

## Pembayaran Online (Poketo)

Pembeli bisa membayar dengan QRIS, Virtual Account, PayLater, atau kartu debit. Tagihan dibuat oleh
Supabase Edge Function (secret key tidak pernah ada di website) dan status **Lunas** hanya diubah oleh
webhook Poketo yang tanda tangannya sudah diverifikasi.

1. Jalankan `supabase/005_fitur_lanjutan.sql` di SQL Editor (jika belum).
2. Di **Poketo** (poketo.id) → Merchant → Pengaturan API: buat API key sandbox (`sk_test_…`).
3. Di **Supabase → Edge Functions**, buat 2 fungsi (Deploy a new function → Via Editor), tempel isi file:
   - `poketo-checkout` ← `supabase/functions/poketo-checkout/index.ts`
   - `poketo-webhook` ← `supabase/functions/poketo-webhook/index.ts`
   Untuk **keduanya**, matikan **Verify JWT / Enforce JWT verification** di pengaturan fungsi.
4. Di **Supabase → Edge Functions → Secrets**, tambahkan:
   - `POKETO_SECRET_KEY` = `sk_test_…` (nanti ganti `sk_live_…` setelah verifikasi Poketo)
   - `POKETO_WEBHOOK_SECRET` = `whsec_…` (langkah 5)
   - `SITE_URL` = `https://tasura-web.vercel.app`
5. Di **Poketo** → Pengaturan API → URL webhook: `https://<project-id>.supabase.co/functions/v1/poketo-webhook`,
   lalu salin rahasia `whsec_…` ke secret `POKETO_WEBHOOK_SECRET`.
6. Dashboard Admin → **Pengaturan** → centang **Aktifkan pembayaran online** → Simpan.
7. Coba checkout dengan "Bayar Online"; di halaman bayar sandbox klik tombol simulasi lunas.
   Status pesanan berubah menjadi **Lunas** dan **Diproses** secara otomatis.
