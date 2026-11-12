-- ============================================================
-- TASURA — Komponen request (custom) di Rakit PC
-- Jalankan SETELAH 002_admin.sql dan 003_rakit_pc.sql
-- Supabase Dashboard → SQL Editor → New query → tempel semua → Run
-- Aman dijalankan ulang.
--
-- Pembeli bisa menulis sendiri komponen yang tidak ada di toko.
-- Komponen ini masuk ke pesanan sebagai item {"custom": true, "slot": "VGA", "nama": "...", "qty": 1, "harga": 0}.
-- Harganya diisi admin di Dashboard → Pesanan setelah komponennya dicarikan.
-- ============================================================

create or replace function public.place_order(
  p_items jsonb, p_nama text, p_hp text, p_alamat text, p_pembayaran text,
  p_promo text default null, p_catatan text default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  it jsonb; p public.products; c public.coupons;
  v_qty integer; v_items jsonb := '[]'; v_subtotal integer := 0; v_diskon integer := 0;
  v_kode text := null; v_id bigint; v_custom integer := 0; v_nama text;
begin
  if coalesce(trim(p_nama), '') = '' or coalesce(trim(p_hp), '') = '' or coalesce(trim(p_alamat), '') = '' then
    raise exception 'Nama, nomor HP, dan alamat wajib diisi';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang masih kosong';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Terlalu banyak item'; end if;

  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 99 then raise exception 'Jumlah barang tidak valid'; end if;

    if coalesce((it->>'custom')::boolean, false) then
      -- Komponen request: tanpa harga & stok, dicarikan admin
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

  insert into public.orders (user_id, items, subtotal, diskon, total, promo, nama, hp, alamat, pembayaran, catatan)
  values (auth.uid(), v_items, v_subtotal, v_diskon, v_subtotal - v_diskon, v_kode,
          left(trim(p_nama), 100), left(trim(p_hp), 30), left(trim(p_alamat), 500),
          left(trim(p_pembayaran), 50), nullif(left(trim(coalesce(p_catatan, '')), 500), ''))
  returning id into v_id;

  return json_build_object('id', v_id, 'items', v_items, 'subtotal', v_subtotal,
                           'diskon', v_diskon, 'total', v_subtotal - v_diskon, 'promo', v_kode,
                           'request', v_custom);
end;
$$;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text) to anon, authenticated;
