-- ============================================================
-- TASURA — Skema database Supabase
-- Jalankan sekali di: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. PROFIL PELANGGAN ------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text,
  hp text,
  alamat text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Lihat profil sendiri" on public.profiles
  for select using (auth.uid() = id);
create policy "Buat profil sendiri" on public.profiles
  for insert with check (auth.uid() = id);
create policy "Ubah profil sendiri" on public.profiles
  for update using (auth.uid() = id);

-- Otomatis membuat profil saat ada akun baru (email maupun Google)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nama, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. PESANAN ---------------------------------------------------
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  items jsonb not null,
  subtotal integer not null,
  diskon integer not null default 0,
  total integer not null,
  promo text,
  nama text not null,
  hp text not null,
  alamat text not null,
  pembayaran text not null,
  status text not null default 'Menunggu Konfirmasi',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Lihat pesanan sendiri" on public.orders
  for select using (auth.uid() = user_id);
create policy "Buat pesanan sendiri" on public.orders
  for insert with check (auth.uid() = user_id and status = 'Menunggu Konfirmasi');

-- Status pesanan (Diproses, Dikirim, Selesai, Dibatalkan) diubah oleh admin
-- lewat Supabase Dashboard → Table Editor → orders.
