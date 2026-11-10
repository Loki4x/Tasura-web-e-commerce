// ====== PENGATURAN TOKO — ubah sesuai kebutuhanmu ======
const STORE = {
  nama: "Tasura",
  whatsapp: "6281234567890", // Ganti dengan nomor WA kamu (format 62xxx, tanpa + atau 0)
  promo: { kode: "TASURA10", diskon: 0.10 },
};

// ====== DAFTAR PRODUK ======
// gambar: isi dengan path foto (mis. "img/tas1.jpg"). Jika kosong, emoji yang ditampilkan.
const PRODUCTS = [
  { id: 1, nama: "Tote Bag Kanvas Premium", kategori: "Tas", harga: 129000, hargaCoret: 179000, rating: 4.9, terjual: 320, emoji: "👜", gambar: "", deskripsi: "Tote bag berbahan kanvas tebal, muat laptop 14 inci, cocok untuk kuliah & kerja." },
  { id: 2, nama: "Sling Bag Kulit Sintetis", kategori: "Tas", harga: 159000, hargaCoret: 0, rating: 4.8, terjual: 210, emoji: "👝", gambar: "", deskripsi: "Sling bag elegan dengan tali adjustable dan banyak kompartemen." },
  { id: 3, nama: "Kemeja Linen Oversize", kategori: "Pakaian", harga: 149000, hargaCoret: 199000, rating: 4.7, terjual: 540, emoji: "👕", gambar: "", deskripsi: "Kemeja linen adem, potongan oversize kekinian. Tersedia ukuran S–XL." },
  { id: 4, nama: "Dress Midi Floral", kategori: "Pakaian", harga: 189000, hargaCoret: 0, rating: 4.9, terjual: 150, emoji: "👗", gambar: "", deskripsi: "Dress midi motif floral dengan bahan rayon lembut dan jatuh." },
  { id: 5, nama: "Sneakers Casual Putih", kategori: "Sepatu", harga: 249000, hargaCoret: 329000, rating: 4.8, terjual: 410, emoji: "👟", gambar: "", deskripsi: "Sneakers putih serbaguna, sol empuk dan anti slip." },
  { id: 6, nama: "Sandal Slide Comfort", kategori: "Sepatu", harga: 79000, hargaCoret: 0, rating: 4.6, terjual: 760, emoji: "🩴", gambar: "", deskripsi: "Sandal slide ringan dan nyaman dipakai seharian." },
  { id: 7, nama: "Jam Tangan Minimalis", kategori: "Aksesoris", harga: 199000, hargaCoret: 259000, rating: 4.8, terjual: 190, emoji: "⌚", gambar: "", deskripsi: "Jam tangan desain minimalis, tali kulit, tahan percikan air." },
  { id: 8, nama: "Kacamata Hitam UV400", kategori: "Aksesoris", harga: 99000, hargaCoret: 0, rating: 4.7, terjual: 280, emoji: "🕶️", gambar: "", deskripsi: "Kacamata dengan perlindungan UV400, frame ringan dan kuat." },
  { id: 9, nama: "Topi Baseball Basic", kategori: "Aksesoris", harga: 59000, hargaCoret: 75000, rating: 4.6, terjual: 630, emoji: "🧢", gambar: "", deskripsi: "Topi baseball bahan katun, strap belakang bisa diatur." },
  { id: 10, nama: "Ransel Laptop Waterproof", kategori: "Tas", harga: 279000, hargaCoret: 349000, rating: 4.9, terjual: 260, emoji: "🎒", gambar: "", deskripsi: "Ransel waterproof dengan slot laptop 15.6 inci dan port USB." },
  { id: 11, nama: "Hoodie Fleece Unisex", kategori: "Pakaian", harga: 219000, hargaCoret: 0, rating: 4.8, terjual: 380, emoji: "🧥", gambar: "", deskripsi: "Hoodie fleece tebal dan hangat, unisex, ukuran M–XXL." },
  { id: 12, nama: "Dompet Kartu Slim", kategori: "Aksesoris", harga: 69000, hargaCoret: 89000, rating: 4.7, terjual: 450, emoji: "💳", gambar: "", deskripsi: "Dompet kartu tipis, muat 8 kartu + uang lipat." },
];
