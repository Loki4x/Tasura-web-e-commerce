# Tasura — Web E-Commerce

Website toko online statis (HTML, CSS, JavaScript). Tidak perlu server atau database.

## Fitur
- Landing page: hero slider, Paling Populer, Kualitas, Cara Pemesanan, testimoni, FAQ, banner ajakan belanja
- Katalog produk, pencarian, filter kategori, urutkan harga/rating
- Keranjang belanja & checkout via WhatsApp, kode promo
- **Akun pelanggan** (Supabase): daftar/masuk dengan email atau Google, lupa password,
  profil (alamat tersimpan & otomatis terisi saat checkout), riwayat & status pesanan

## Cara menjalankan
Buka `index.html` di browser.

## Cara mengubah
- **Nomor WhatsApp & kode promo**: edit `STORE` di `products.js`
- **Produk**: edit `PRODUCTS` di `products.js` (nama, harga, kategori, deskripsi)
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
