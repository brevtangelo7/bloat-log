-- ═══════════════════════════════════════════════════════
-- Bloat Log — Supabase Schema
-- Paste this into the Supabase SQL editor (Dashboard → SQL → New query)
-- ═══════════════════════════════════════════════════════

-- ── profiles ──────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  is_disabled boolean not null default false
);

-- ── entries ───────────────────────────────────────────
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  foods text,
  severity text check (severity in ('None', 'Low', 'Medium', 'High') or severity is null or severity = ''),
  time_to_bloat text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists entries_user_id_created_at_idx
  on public.entries(user_id, created_at desc);

-- ── auto-create profile on signup ─────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, created_at, last_seen_at)
  values (new.id, now(), now())
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Enable RLS ────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;

-- ── Admin helper (reads VITE_ADMIN_EMAIL at query time via JWT email claim)
-- Admin is identified by email matching a value in auth.users. We look up the
-- currently-authenticated user's email and compare with the admin_emails table.

create table if not exists public.admin_emails (
  email text primary key
);

-- Insert your admin email after running this script, e.g.:
--   insert into public.admin_emails (email) values ('you@example.com');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_emails ae
    join auth.users u on u.email = ae.email
    where u.id = auth.uid()
  );
$$;

-- ── profiles policies ─────────────────────────────────
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_delete_self" on public.profiles;
create policy "profiles_delete_self" on public.profiles
  for delete
  using (auth.uid() = id);

-- ── entries policies ──────────────────────────────────
drop policy if exists "entries_select_self_or_admin" on public.entries;
create policy "entries_select_self_or_admin" on public.entries
  for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "entries_insert_self" on public.entries;
create policy "entries_insert_self" on public.entries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "entries_update_self" on public.entries;
create policy "entries_update_self" on public.entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entries_delete_self" on public.entries;
create policy "entries_delete_self" on public.entries
  for delete
  using (auth.uid() = user_id);

-- ── admin_emails policies (only admins can see; no-one inserts via API) ──
alter table public.admin_emails enable row level security;

drop policy if exists "admin_emails_read_admin" on public.admin_emails;
create policy "admin_emails_read_admin" on public.admin_emails
  for select using (public.is_admin());

-- ── Admin RPC: list user emails (admin-only) ──────────
create or replace function public.admin_user_emails()
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text
  from auth.users u
  where public.is_admin();
$$;

grant execute on function public.admin_user_emails() to authenticated;

-- ═══════════════════════════════════════════════════════
-- AFTER running this, add your admin email:
--   insert into public.admin_emails (email) values ('YOUR_ADMIN_EMAIL');
-- ═══════════════════════════════════════════════════════
