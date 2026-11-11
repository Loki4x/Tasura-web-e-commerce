// ====== DATA CADANGAN ======
// Jika Supabase sudah tersambung, produk, nomor WhatsApp, dan kupon diambil dari database
// dan dikelola lewat Dashboard Admin (admin.html). Data di file ini hanya dipakai jika
// Supabase belum diatur atau sedang tidak bisa dihubungi.

// ====== PENGATURAN TOKO ======
const STORE = {
  nama: "Tasura",
  whatsapp: "6287779242830", // Nomor WA toko (format 62xxx, tanpa + atau 0)
  promo: { kode: "TASURA10", diskon: 0.10 },
};

// ====== DAFTAR PRODUK ======
// gambar: isi dengan path foto (mis. "img/rtx4060.jpg"). Jika kosong, emoji yang ditampilkan.
// spek: daftar spesifikasi singkat yang tampil di halaman detail produk.
let PRODUCTS = [
  { id: 1, nama: "PC Gaming Ryzen 5 7500F + RTX 4060", kategori: "PC Rakitan", harga: 12499000, hargaCoret: 13299000, rating: 4.9, terjual: 86, emoji: "🖥️", gambar: "",
    deskripsi: "PC rakitan siap main game AAA di 1080p ultra dan 1440p high. Sudah dirakit rapi, cable management bersih, dan dites stress test sebelum dikirim.",
    spek: ["Processor AMD Ryzen 5 7500F (6C/12T)", "VGA GeForce RTX 4060 8GB", "RAM 16GB DDR5 5600MHz", "SSD NVMe Gen4 1TB", "Motherboard B650M", "PSU 650W 80+ Bronze", "Casing mATX ARGB"] },
  { id: 2, nama: "PC Office Intel Core i3-12100", kategori: "PC Rakitan", harga: 5299000, hargaCoret: 0, rating: 4.8, terjual: 54, emoji: "🖥️", gambar: "",
    deskripsi: "PC kantor dan sekolah yang cepat, hemat listrik, dan senyap. Cocok untuk Office, browsing, dan meeting online.",
    spek: ["Processor Intel Core i3-12100", "Grafis Intel UHD 730", "RAM 8GB DDR4 3200MHz", "SSD NVMe 512GB", "Motherboard H610M", "PSU 450W"] },
  { id: 3, nama: "Monitor 24\" IPS 165Hz FHD", kategori: "Monitor", harga: 1899000, hargaCoret: 2199000, rating: 4.9, terjual: 142, emoji: "📺", gambar: "",
    deskripsi: "Monitor gaming 24 inci panel IPS dengan refresh rate 165Hz, warna akurat dan sudut pandang luas.",
    spek: ["Ukuran 23.8 inci", "Resolusi 1920×1080", "Refresh rate 165Hz, 1ms", "Panel IPS, 99% sRGB", "Port HDMI 2.0, DisplayPort 1.4", "Adaptive Sync"] },
  { id: 4, nama: "Monitor 27\" IPS 2K 180Hz", kategori: "Monitor", harga: 3499000, hargaCoret: 0, rating: 4.8, terjual: 63, emoji: "📺", gambar: "",
    deskripsi: "Monitor 27 inci resolusi QHD untuk gaming kompetitif sekaligus kerja desain.",
    spek: ["Ukuran 27 inci", "Resolusi 2560×1440", "Refresh rate 180Hz, 1ms", "Panel Fast IPS, HDR400", "Port 2× HDMI, 1× DisplayPort"] },
  { id: 5, nama: "AMD Ryzen 5 7500F", kategori: "Processor", harga: 2299000, hargaCoret: 0, rating: 4.9, terjual: 97, emoji: "🧠", gambar: "",
    deskripsi: "Processor 6 core arsitektur Zen 4 untuk platform AM5, pilihan favorit untuk PC gaming budget.",
    spek: ["6 Core / 12 Thread", "Clock hingga 5.0GHz", "Socket AM5", "Mendukung DDR5", "TDP 65W", "Tanpa grafis terintegrasi"] },
  { id: 6, nama: "Intel Core i5-12400F", kategori: "Processor", harga: 1799000, hargaCoret: 1999000, rating: 4.8, terjual: 88, emoji: "🧠", gambar: "",
    deskripsi: "Processor 6 core yang efisien dan bertenaga untuk gaming dan produktivitas.",
    spek: ["6 Core / 12 Thread", "Clock hingga 4.4GHz", "Socket LGA1700", "Mendukung DDR4 & DDR5", "TDP 65W", "Tanpa grafis terintegrasi"] },
  { id: 7, nama: "VGA GeForce RTX 4060 8GB", kategori: "VGA", harga: 4799000, hargaCoret: 5199000, rating: 4.9, terjual: 121, emoji: "🎮", gambar: "",
    deskripsi: "Kartu grafis hemat daya dengan DLSS 3 dan ray tracing, ideal untuk gaming 1080p.",
    spek: ["Memori 8GB GDDR6", "Bus 128-bit", "DLSS 3 & Ray Tracing", "Konektor daya 1× 8-pin", "Rekomendasi PSU 550W", "Output 3× DP, 1× HDMI"] },
  { id: 8, nama: "RAM DDR5 16GB (2×8GB) 5600MHz", kategori: "RAM", harga: 899000, hargaCoret: 0, rating: 4.8, terjual: 110, emoji: "💾", gambar: "",
    deskripsi: "Kit dual channel DDR5 dengan heatspreader aluminium, plug and play dengan profil XMP/EXPO.",
    spek: ["Kapasitas 16GB (2×8GB)", "Kecepatan 5600MHz", "Latency CL36", "Mendukung XMP 3.0 & EXPO", "Tegangan 1.25V"] },
  { id: 9, nama: "SSD NVMe M.2 1TB Gen4", kategori: "Storage", harga: 1149000, hargaCoret: 1349000, rating: 4.9, terjual: 156, emoji: "💽", gambar: "",
    deskripsi: "SSD super cepat untuk booting Windows dan loading game dalam hitungan detik.",
    spek: ["Kapasitas 1TB", "Interface PCIe 4.0 x4 NVMe", "Baca hingga 5000MB/s", "Tulis hingga 4500MB/s", "Form factor M.2 2280"] },
  { id: 10, nama: "Motherboard B650M WiFi", kategori: "Motherboard", harga: 2149000, hargaCoret: 0, rating: 4.7, terjual: 47, emoji: "🧩", gambar: "",
    deskripsi: "Motherboard mATX untuk processor AMD Ryzen 7000 dengan WiFi bawaan dan dukungan DDR5.",
    spek: ["Socket AM5", "Form factor Micro-ATX", "4× slot DDR5", "2× slot M.2 NVMe", "WiFi 6 & Bluetooth", "USB Type-C belakang"] },
  { id: 11, nama: "PSU 650W 80+ Bronze", kategori: "PSU", harga: 749000, hargaCoret: 849000, rating: 4.8, terjual: 73, emoji: "🔌", gambar: "",
    deskripsi: "Power supply stabil dengan sertifikasi 80+ Bronze, aman untuk PC gaming kelas menengah.",
    spek: ["Daya 650W", "Sertifikasi 80+ Bronze", "Kipas 120mm senyap", "Proteksi OVP/OCP/SCP", "Konektor 2× PCIe 8-pin"] },
  { id: 12, nama: "Casing mATX Tempered Glass ARGB", kategori: "Casing", harga: 549000, hargaCoret: 0, rating: 4.7, terjual: 65, emoji: "🗄️", gambar: "",
    deskripsi: "Casing dengan panel kaca tempered dan 4 kipas ARGB, airflow lega dan tampilan keren.",
    spek: ["Form factor mATX / ITX", "Panel samping tempered glass", "Termasuk 4 kipas ARGB", "Panjang VGA maks. 320mm", "Tinggi cooler maks. 160mm"] },
  { id: 13, nama: "Keyboard Mechanical TKL Hot-swap", kategori: "Aksesoris", harga: 449000, hargaCoret: 529000, rating: 4.8, terjual: 134, emoji: "⌨️", gambar: "",
    deskripsi: "Keyboard mekanikal tenkeyless dengan switch hot-swap dan lampu RGB.",
    spek: ["Layout TKL 87 tombol", "Switch hot-swap", "Backlight RGB", "Koneksi kabel USB-C", "Keycaps double-shot"] },
  { id: 14, nama: "Mouse Gaming Wireless 26K DPI", kategori: "Aksesoris", harga: 299000, hargaCoret: 0, rating: 4.7, terjual: 118, emoji: "🖱️", gambar: "",
    deskripsi: "Mouse gaming ringan dengan sensor presisi tinggi dan koneksi wireless latensi rendah.",
    spek: ["Sensor hingga 26.000 DPI", "Berat 63 gram", "Wireless 2.4GHz & kabel", "Baterai hingga 70 jam"] },
  { id: 15, nama: "Headset Gaming 7.1 Surround", kategori: "Aksesoris", harga: 379000, hargaCoret: 0, rating: 4.6, terjual: 82, emoji: "🎧", gambar: "",
    deskripsi: "Headset nyaman dengan suara surround 7.1 virtual dan mikrofon jernih untuk mabar.",
    spek: ["Driver 50mm", "Virtual surround 7.1", "Mikrofon noise-cancelling", "Koneksi USB & jack 3.5mm"] },
];
