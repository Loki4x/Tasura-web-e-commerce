-- ============================================================
-- TASURA — Fitur Rakit PC (jalankan SETELAH 002_admin.sql)
-- Supabase Dashboard → SQL Editor → New query → tempel semua → Run
-- Aman dijalankan ulang.
-- ============================================================

-- Data kompatibilitas tiap komponen, contoh:
--   Processor   : {"socket":"AM5","watt":65,"igpu":false}
--   Motherboard : {"socket":"AM5","ram":"DDR5","form":"mATX"}
--   RAM         : {"ram":"DDR5"}
--   VGA         : {"watt":115,"panjang":240}
--   PSU         : {"watt":650}
--   Casing      : {"form":"ATX","vga_maks":380}
--   Cooler      : {"socket":"AM4,AM5,LGA1700"}
-- Bisa diisi lewat Dashboard Admin → Produk → Edit → bagian "Kompatibilitas Rakit PC".
alter table public.products add column if not exists atribut jsonb not null default '{}'::jsonb;

-- Lengkapi data kompatibilitas produk contoh (hanya jika masih kosong)
update public.products set atribut = '{"socket":"AM5","watt":65,"igpu":false}'::jsonb where nama = 'AMD Ryzen 5 7500F' and atribut = '{}'::jsonb;
update public.products set atribut = '{"socket":"LGA1700","watt":65,"igpu":false}'::jsonb where nama = 'Intel Core i5-12400F' and atribut = '{}'::jsonb;
update public.products set atribut = '{"watt":115,"panjang":240}'::jsonb where nama = 'VGA GeForce RTX 4060 8GB' and atribut = '{}'::jsonb;
update public.products set atribut = '{"ram":"DDR5"}'::jsonb where nama = 'RAM DDR5 16GB (2×8GB) 5600MHz' and atribut = '{}'::jsonb;
update public.products set atribut = '{"socket":"AM5","ram":"DDR5","form":"mATX"}'::jsonb where nama = 'Motherboard B650M WiFi' and atribut = '{}'::jsonb;
update public.products set atribut = '{"watt":650}'::jsonb where nama = 'PSU 650W 80+ Bronze' and atribut = '{}'::jsonb;
update public.products set atribut = '{"form":"mATX","vga_maks":320}'::jsonb where nama = 'Casing mATX Tempered Glass ARGB' and atribut = '{}'::jsonb;

-- Komponen contoh tambahan (dilewati jika nama produk sudah ada)
insert into public.products (nama, kategori, harga, harga_coret, stok, rating, terjual, emoji, deskripsi, spek, atribut, urutan)
select v.* from (values
  ('AMD Ryzen 7 7700', 'Processor', 4199000, 0, 8, 4.9, 41, '🧠', 'Processor 8 core Zen 4 dengan grafis Radeon bawaan dan cooler box, kencang untuk gaming dan streaming.', array['8 Core / 16 Thread', 'Clock hingga 5.3GHz', 'Socket AM5', 'Grafis terintegrasi Radeon', 'TDP 65W', 'Termasuk cooler Wraith Prism']::text[], '{"socket":"AM5","watt":65,"igpu":true}'::jsonb, 16),
  ('Intel Core i5-13400', 'Processor', 3099000, 3299000, 10, 4.8, 52, '🧠', 'Processor 10 core dengan grafis Intel UHD 730 bawaan, cocok untuk kerja dan gaming ringan tanpa VGA.', array['10 Core (6P+4E) / 16 Thread', 'Clock hingga 4.6GHz', 'Socket LGA1700', 'Grafis Intel UHD 730', 'TDP 65W']::text[], '{"socket":"LGA1700","watt":65,"igpu":true}'::jsonb, 17),
  ('Motherboard B760M DDR4', 'Motherboard', 1699000, 0, 12, 4.7, 38, '🧩', 'Motherboard mATX untuk Intel generasi 12–14 dengan dukungan RAM DDR4 yang lebih hemat.', array['Socket LGA1700', 'Form factor Micro-ATX', '4× slot DDR4', '2× slot M.2 NVMe', 'LAN 2.5GbE']::text[], '{"socket":"LGA1700","ram":"DDR4","form":"mATX"}'::jsonb, 18),
  ('Motherboard X670E ATX WiFi', 'Motherboard', 4599000, 4999000, 5, 4.8, 17, '🧩', 'Motherboard ATX kelas atas untuk Ryzen 7000/9000 dengan PCIe 5.0 dan WiFi 6E.', array['Socket AM5', 'Form factor ATX', '4× slot DDR5', 'PCIe 5.0 x16 & M.2 Gen5', 'WiFi 6E & Bluetooth 5.3']::text[], '{"socket":"AM5","ram":"DDR5","form":"ATX"}'::jsonb, 19),
  ('RAM DDR4 16GB (2×8GB) 3200MHz', 'RAM', 529000, 0, 25, 4.8, 96, '💾', 'Kit DDR4 dual channel yang stabil untuk platform Intel dan AMD generasi sebelumnya.', array['Kapasitas 16GB (2×8GB)', 'Kecepatan 3200MHz', 'Latency CL16', 'Mendukung XMP 2.0']::text[], '{"ram":"DDR4"}'::jsonb, 20),
  ('RAM DDR5 32GB (2×16GB) 6000MHz', 'RAM', 1599000, 1799000, 20, 4.9, 58, '💾', 'Kit DDR5 kencang 6000MHz, sweet spot untuk Ryzen 7000 dan gaming kelas atas.', array['Kapasitas 32GB (2×16GB)', 'Kecepatan 6000MHz', 'Latency CL30', 'Mendukung EXPO & XMP 3.0']::text[], '{"ram":"DDR5"}'::jsonb, 21),
  ('VGA Radeon RX 7600 8GB', 'VGA', 4199000, 0, 10, 4.7, 44, '🎮', 'Kartu grafis untuk gaming 1080p rata kanan dengan harga bersahabat.', array['Memori 8GB GDDR6', 'Bus 128-bit', 'Konektor daya 1× 8-pin', 'Rekomendasi PSU 550W', 'Panjang 250mm']::text[], '{"watt":165,"panjang":250}'::jsonb, 22),
  ('VGA GeForce RTX 4070 Super 12GB', 'VGA', 10499000, 10999000, 6, 4.9, 29, '🎮', 'Performa tinggi untuk gaming 1440p dan kerja kreatif, lengkap dengan DLSS 3.', array['Memori 12GB GDDR6X', 'Bus 192-bit', 'DLSS 3 & Ray Tracing', 'Rekomendasi PSU 650W', 'Panjang 310mm']::text[], '{"watt":220,"panjang":310}'::jsonb, 23),
  ('SSD NVMe M.2 512GB Gen3', 'Storage', 549000, 0, 30, 4.8, 120, '💽', 'SSD NVMe hemat untuk sistem operasi dan aplikasi harian.', array['Kapasitas 512GB', 'Interface PCIe 3.0 x4 NVMe', 'Baca hingga 3500MB/s', 'Form factor M.2 2280']::text[], '{}'::jsonb, 24),
  ('PSU 850W 80+ Gold Full Modular', 'PSU', 1649000, 0, 10, 4.9, 33, '🔌', 'Power supply full modular bersertifikasi Gold, cocok untuk VGA kelas atas dan upgrade ke depan.', array['Daya 850W', 'Sertifikasi 80+ Gold', 'Full modular', 'Konektor 12VHPWR', 'Garansi 10 tahun']::text[], '{"watt":850}'::jsonb, 25),
  ('Casing ATX Mid Tower Airflow', 'Casing', 899000, 999000, 12, 4.8, 37, '🗄️', 'Casing ATX dengan panel depan mesh untuk airflow maksimal dan ruang VGA panjang.', array['Mendukung ATX / mATX / ITX', 'Panel depan mesh', 'Termasuk 3 kipas ARGB', 'Panjang VGA maks. 380mm', 'Tinggi cooler maks. 170mm']::text[], '{"form":"ATX","vga_maks":380}'::jsonb, 26),
  ('CPU Cooler Tower 4 Heatpipe ARGB', 'Cooler', 349000, 0, 20, 4.7, 64, '❄️', 'Pendingin udara tower yang senyap untuk processor hingga 180W.', array['4 heatpipe tembaga', 'Kipas 120mm ARGB', 'Mendukung AM4/AM5/LGA1700', 'Tinggi 155mm']::text[], '{"socket":"AM4,AM5,LGA1700"}'::jsonb, 27)
) as v(nama, kategori, harga, harga_coret, stok, rating, terjual, emoji, deskripsi, spek, atribut, urutan)
where not exists (select 1 from public.products p where p.nama = v.nama);
