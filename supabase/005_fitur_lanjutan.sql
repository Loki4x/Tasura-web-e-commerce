-- ============================================================
-- TASURA — Fitur lanjutan (jalankan SETELAH 002, 003, dan 004)
--   • Titik lokasi pengiriman (peta)        • Status pembayaran online (Poketo)
--   • Lacak pesanan untuk tamu              • Ulasan pembeli
--   • Notifikasi stok tersedia              • Banyak foto per produk
--   • Rakitan rekomendasi (paket budget)
-- Supabase Dashboard → SQL Editor → New query → tempel semua → Run
-- Aman dijalankan ulang.
-- ============================================================

-- 1. PESANAN: lokasi & pembayaran ------------------------------------
alter table public.orders add column if not exists lokasi_lat double precision;
alter table public.orders add column if not exists lokasi_lng double precision;
alter table public.orders add column if not exists bayar_status text not null default 'belum';
alter table public.orders add column if not exists bayar_invoice text;   -- id tagihan Poketo (INV-PKT-…)
alter table public.orders add column if not exists bayar_url text;       -- link halaman bayar Poketo
alter table public.orders add column if not exists bayar_metode text;    -- QRIS / VA / AKULAKU / CARD / manual
alter table public.orders add column if not exists dibayar_at timestamptz;
alter table public.orders drop constraint if exists orders_bayar_status_check;
alter table public.orders add constraint orders_bayar_status_check
  check (bayar_status in ('belum', 'menunggu', 'lunas', 'kedaluwarsa', 'dibatalkan', 'refund'));

-- place_order kini menerima titik lokasi (p_lat, p_lng)
drop function if exists public.place_order(jsonb, text, text, text, text, text, text);
create or replace function public.place_order(
  p_items jsonb, p_nama text, p_hp text, p_alamat text, p_pembayaran text,
  p_promo text default null, p_catatan text default null,
  p_lat double precision default null, p_lng double precision default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  it jsonb; p public.products; c public.coupons;
  v_qty integer; v_items jsonb := '[]'; v_subtotal integer := 0; v_diskon integer := 0;
  v_kode text := null; v_id bigint; v_custom integer := 0; v_nama text;
begin
  if coalesce(trim(p_nama), '') = '' or coalesce(trim(p_hp), '') = '' or coalesce(trim(p_alamat), '') = '' then
    raise exception 'Nama, nomor HP, dan alamat wajib diisi';
  end if;
  if (p_lat is null) <> (p_lng is null) or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Titik lokasi tidak valid';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang masih kosong';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Terlalu banyak item'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Jumlah barang tidak valid'; end if;
    if coalesce((it->>'custom')::boolean, false) then
      v_custom := v_custom + 1;
      if v_custom > 10 then raise exception 'Maksimal 10 komponen request per pesanan'; end if;
      if v_qty > 10 then raise exception 'Jumlah komponen request terlalu banyak'; end if;
      v_nama := left(trim(coalesce(it->>'nama', '')), 150);
      if v_nama = '' then raise exception 'Nama komponen request wajib diisi'; end if;
      v_items := v_items || jsonb_build_object('custom', true, 'slot', left(trim(coalesce(it->>'slot', '')), 40),
                                               'nama', v_nama, 'harga', 0, 'qty', v_qty);
      continue;
    end if;
    select * into p from public.products where id = (it->>'id')::bigint and aktif for update;
    if not found then raise exception 'Ada produk yang sudah tidak tersedia, silakan muat ulang halaman'; end if;
    if p.stok < v_qty then raise exception 'Stok % tinggal %', p.nama, p.stok; end if;
    v_items := v_items || jsonb_build_object('id', p.id, 'nama', p.nama, 'harga', p.harga, 'qty', v_qty);
    v_subtotal := v_subtotal + p.harga * v_qty;
    update public.products set stok = stok - v_qty, terjual = terjual + v_qty where id = p.id;
  end loop;

  if coalesce(trim(p_promo), '') <> '' then
    select * into c from public.coupons where kode = upper(trim(p_promo)) for update;
    if not found or not c.aktif
       or (c.berlaku_sampai is not null and c.berlaku_sampai < now())
       or (c.kuota is not null and c.terpakai >= c.kuota)
       or v_subtotal < c.min_belanja then
      raise exception 'Kode promo tidak bisa dipakai';
    end if;
    v_diskon := public.hitung_diskon(c, v_subtotal);
    v_kode := c.kode;
    update public.coupons set terpakai = terpakai + 1 where id = c.id;
  end if;

  insert into public.orders (user_id, items, subtotal, diskon, total, promo, nama, hp, alamat, pembayaran, catatan, lokasi_lat, lokasi_lng)
  values (auth.uid(), v_items, v_subtotal, v_diskon, v_subtotal - v_diskon, v_kode,
          left(trim(p_nama), 100), left(trim(p_hp), 30), left(trim(p_alamat), 500),
          left(trim(p_pembayaran), 50), nullif(left(trim(coalesce(p_catatan, '')), 500), ''), p_lat, p_lng)
  returning id into v_id;

  return json_build_object('id', v_id, 'items', v_items, 'subtotal', v_subtotal,
                           'diskon', v_diskon, 'total', v_subtotal - v_diskon, 'promo', v_kode,
                           'request', v_custom);
end;
$$;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text, double precision, double precision) to anon, authenticated;

-- 2. LACAK PESANAN (tamu cukup nomor pesanan + nomor HP) --------------
create or replace function public.norm_hp(p text)
returns text language sql immutable as $$
  select case when d like '0%' then '62' || substr(d, 2) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.track_order(p_id bigint, p_hp text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_id;
  if not found or length(public.norm_hp(p_hp)) < 9 or public.norm_hp(p_hp) <> public.norm_hp(o.hp) then
    return null; -- tidak membedakan "tidak ada" dan "HP salah"
  end if;
  return json_build_object(
    'id', o.id, 'created_at', o.created_at, 'updated_at', o.updated_at, 'status', o.status, 'resi', o.resi,
    'items', o.items, 'subtotal', o.subtotal, 'diskon', o.diskon, 'total', o.total, 'promo', o.promo,
    'nama', o.nama, 'hp', o.hp, 'alamat', o.alamat, 'pembayaran', o.pembayaran, 'catatan', o.catatan,
    'lokasi_lat', o.lokasi_lat, 'lokasi_lng', o.lokasi_lng,
    'bayar_status', o.bayar_status, 'bayar_url', o.bayar_url, 'bayar_metode', o.bayar_metode, 'dibayar_at', o.dibayar_at);
end;
$$;
grant execute on function public.track_order(bigint, text) to anon, authenticated;

-- 3. BANYAK FOTO PER PRODUK -------------------------------------------
alter table public.products add column if not exists gambar_list text[] not null default '{}';  -- foto tambahan
alter table public.products add column if not exists jumlah_ulasan integer not null default 0;

-- 4. ULASAN PEMBELI ---------------------------------------------------
create table if not exists public.reviews (
  id bigint generated by default as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  order_id bigint references public.orders(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  nama text not null,
  rating integer not null check (rating between 1 and 5),
  komentar text check (length(komentar) <= 1000),
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);
alter table public.reviews enable row level security;
drop policy if exists "Lihat ulasan" on public.reviews;
create policy "Lihat ulasan" on public.reviews for select
  using (approved or user_id = auth.uid() or public.is_admin());
drop policy if exists "Admin ubah ulasan" on public.reviews;
create policy "Admin ubah ulasan" on public.reviews for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admin hapus ulasan" on public.reviews;
create policy "Admin hapus ulasan" on public.reviews for delete using (public.is_admin());

-- Ulasan hanya dari pembeli yang pesanannya sudah Selesai dan berisi produk tsb.
create or replace function public.submit_review(p_order bigint, p_product bigint, p_rating integer, p_komentar text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare o public.orders; v_nama text; v_id bigint;
begin
  if auth.uid() is null then raise exception 'Masuk dulu untuk memberi ulasan'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Rating harus 1–5'; end if;
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found then raise exception 'Pesanan tidak ditemukan'; end if;
  if o.status <> 'Selesai' then raise exception 'Ulasan bisa diberikan setelah pesanan selesai'; end if;
  if not o.items @> jsonb_build_array(jsonb_build_object('id', p_product)) then
    raise exception 'Produk ini tidak ada di pesananmu';
  end if;
  select coalesce(nullif(trim(nama), ''), o.nama) into v_nama from public.profiles where id = auth.uid();
  insert into public.reviews (product_id, order_id, user_id, nama, rating, komentar)
  values (p_product, p_order, auth.uid(), left(coalesce(v_nama, o.nama), 60), p_rating,
          nullif(left(trim(coalesce(p_komentar, '')), 1000), ''))
  returning id into v_id;
  return json_build_object('id', v_id);
exception when unique_violation then
  raise exception 'Kamu sudah memberi ulasan untuk produk ini';
end;
$$;
grant execute on function public.submit_review(bigint, bigint, integer, text) to authenticated;

-- Rating produk = rata-rata ulasan yang disetujui (jika belum ada, rating lama dipertahankan)
create or replace function public.recalc_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid bigint := coalesce(new.product_id, old.product_id); v_avg numeric; v_n integer;
begin
  select round(avg(rating)::numeric, 1), count(*) into v_avg, v_n from public.reviews where product_id = pid and approved;
  update public.products set jumlah_ulasan = v_n, rating = coalesce(v_avg, rating) where id = pid;
  return null;
end;
$$;
drop trigger if exists on_review_change on public.reviews;
create trigger on_review_change after insert or update or delete on public.reviews
  for each row execute function public.recalc_rating();

-- 5. NOTIFIKASI STOK TERSEDIA -------------------------------------------
create table if not exists public.stock_alerts (
  id bigint generated by default as identity primary key,
  product_id bigint not null references public.products(id) on delete cascade,
  nama text,
  hp text not null,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.stock_alerts enable row level security;
drop policy if exists "Admin kelola notifikasi stok" on public.stock_alerts;
create policy "Admin kelola notifikasi stok" on public.stock_alerts for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.request_stock_alert(p_product bigint, p_nama text, p_hp text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_hp text := public.norm_hp(p_hp);
begin
  if length(v_hp) not between 9 and 15 then raise exception 'Nomor WhatsApp tidak valid'; end if;
  if not exists (select 1 from public.products where id = p_product and aktif) then raise exception 'Produk tidak ditemukan'; end if;
  if (select count(*) from public.stock_alerts where product_id = p_product and notified_at is null) >= 500 then
    raise exception 'Daftar tunggu produk ini sudah penuh';
  end if;
  if not exists (select 1 from public.stock_alerts where product_id = p_product and hp = v_hp and notified_at is null) then
    insert into public.stock_alerts (product_id, nama, hp) values (p_product, nullif(left(trim(coalesce(p_nama, '')), 60), ''), v_hp);
  end if;
  return true;
end;
$$;
grant execute on function public.request_stock_alert(bigint, text, text) to anon, authenticated;

-- 6. RAKITAN REKOMENDASI ------------------------------------------------
-- komponen: {"processor":[id,qty], "ram":[id,qty], ...} (format sama dengan link rakitan)
create table if not exists public.build_presets (
  id bigint generated by default as identity primary key,
  nama text not null,
  label text,              -- contoh: "Gaming", "Editing", "Kantor"
  deskripsi text,
  komponen jsonb not null default '{}'::jsonb,
  aktif boolean not null default true,
  urutan integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.build_presets enable row level security;
drop policy if exists "Semua lihat rakitan aktif" on public.build_presets;
create policy "Semua lihat rakitan aktif" on public.build_presets for select using (aktif or public.is_admin());
drop policy if exists "Admin kelola rakitan" on public.build_presets;
create policy "Admin kelola rakitan" on public.build_presets for all using (public.is_admin()) with check (public.is_admin());

create or replace function pg_temp.part(p_nama text, p_qty integer default 1)
returns jsonb language sql as $$ select jsonb_build_array(id, p_qty) from public.products where nama = p_nama limit 1 $$;

insert into public.build_presets (nama, label, deskripsi, komponen, urutan)
select * from (values
  ('Gaming 1080p', 'Gaming', 'Main game AAA lancar di 1080p ultra. Pilihan paling seimbang untuk gamer.',
   jsonb_strip_nulls(jsonb_build_object(
     'processor', pg_temp.part('AMD Ryzen 5 7500F'), 'motherboard', pg_temp.part('Motherboard B650M WiFi'),
     'ram', pg_temp.part('RAM DDR5 16GB (2×8GB) 5600MHz'), 'vga', pg_temp.part('VGA GeForce RTX 4060 8GB'),
     'storage', pg_temp.part('SSD NVMe M.2 1TB Gen4'), 'psu', pg_temp.part('PSU 650W 80+ Bronze'),
     'casing', pg_temp.part('Casing mATX Tempered Glass ARGB'))), 1),
  ('Gaming & Streaming 1440p', 'Gaming', 'Rata kanan di 1440p, kuat untuk streaming dan editing video.',
   jsonb_strip_nulls(jsonb_build_object(
     'processor', pg_temp.part('AMD Ryzen 7 7700'), 'motherboard', pg_temp.part('Motherboard X670E ATX WiFi'),
     'ram', pg_temp.part('RAM DDR5 32GB (2×16GB) 6000MHz'), 'vga', pg_temp.part('VGA GeForce RTX 4070 Super 12GB'),
     'storage', pg_temp.part('SSD NVMe M.2 1TB Gen4'), 'psu', pg_temp.part('PSU 850W 80+ Gold Full Modular'),
     'casing', pg_temp.part('Casing ATX Mid Tower Airflow'), 'cooler', pg_temp.part('CPU Cooler Tower 4 Heatpipe ARGB'))), 2),
  ('Kantor & Sekolah', 'Kantor', 'Hemat, senyap, dan cepat untuk Office, browsing, dan meeting online. Tanpa VGA.',
   jsonb_strip_nulls(jsonb_build_object(
     'processor', pg_temp.part('Intel Core i5-13400'), 'motherboard', pg_temp.part('Motherboard B760M DDR4'),
     'ram', pg_temp.part('RAM DDR4 16GB (2×8GB) 3200MHz'), 'storage', pg_temp.part('SSD NVMe M.2 512GB Gen3'),
     'psu', pg_temp.part('PSU 650W 80+ Bronze'), 'casing', pg_temp.part('Casing mATX Tempered Glass ARGB'))), 3)
) as v(nama, label, deskripsi, komponen, urutan)
where not exists (select 1 from public.build_presets);

-- 7. PEMBAYARAN ONLINE: catatan event webhook (anti dobel) -------------------
create table if not exists public.payment_events (
  id text primary key,          -- Poketo-Event-Id (evt_…)
  type text not null,
  invoice text,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;
-- Tanpa policy: hanya Edge Function (service role) yang menulis/membaca.

-- Realtime untuk notifikasi ulasan & stok di dashboard (opsional)
do $$ begin
  alter publication supabase_realtime add table public.reviews;
exception when duplicate_object then null; when undefined_object then null;
end $$;
