-- ============================================================
-- FitWeek — Supabase Consolidated Migration v2
-- ============================================================
-- Run in: Supabase Dashboard → SQL Editor → New query
--
-- What changed from v1:
--   * public.users is DEPRECATED. profiles (managed by the API
--     server via Drizzle) is now the single source of truth for
--     all user identity data (name, avatar, model photo, etc.).
--   * user-models storage bucket changed from public → private.
--     Signed URLs are issued by the API server using the
--     service-role key. Users' model photos are no longer
--     publicly accessible by guessing a storage path.
--   * RLS policies added for garments, outfit_slots, vto_results.
--   * An on-signup trigger creates the profiles row automatically
--     so the API server never has to upsert-or-create.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 0. Extensions
-- ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ──────────────────────────────────────────────────────────────
-- 1. ENUM types (idempotent)
-- ──────────────────────────────────────────────────────────────
do $$ begin
  create type garment_status as enum ('active', 'laundry', 'deleted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type outfit_slot_status as enum ('draft', 'confirmed', 'skipped', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vto_status as enum ('pending', 'ready', 'failed');
exception when duplicate_object then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- 2. profiles — canonical user identity table
--    Managed by the API server (Drizzle ORM).
--    id = auth.users.id (set by on-signup trigger below).
-- ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text,
  avatar_url              text,
  -- Storage PATH (not a public URL) — signed URLs issued by API server
  model_photo_url         text,
  -- Mirrors auth.users.email for fast reads; synced on each sign-in
  email                   text,
  -- ISO 8601 date (YYYY-MM-DD); optional
  birthdate               text,
  location_city           text,
  notifications_enabled   boolean not null default false,
  -- Authoritative onboarding flag (replaces AsyncStorage on mobile)
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each user may only read/write their own profile row
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Service-role (API server) can manage all rows — bypasses RLS automatically
-- (service_role key always bypasses RLS; no explicit policy needed)

-- ──────────────────────────────────────────────────────────────
-- 3. Auto-create profile on sign-up (trigger)
--    Fires after a new auth.users row is inserted so the API
--    server always finds a pre-existing profile row on first
--    request — no upsert-or-create needed.
-- ──────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, avatar_url, display_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ──────────────────────────────────────────────────────────────
-- 4. DEPRECATED: public.users (legacy v1 table)
--    Kept for backward compatibility during the transition.
--    Will be removed in v3 after data migration is complete.
--    New code must NOT write to this table.
-- ──────────────────────────────────────────────────────────────
-- The old table may still exist; add a comment so it's clearly
-- marked as deprecated in the Supabase table editor.
do $$ begin
  comment on table public.users is
    'DEPRECATED v1 — superseded by public.profiles. Do not write to this table. Will be dropped in v3.';
exception when undefined_table then null; end $$;

-- ──────────────────────────────────────────────────────────────
-- 5. garments — RLS policies
-- ──────────────────────────────────────────────────────────────
alter table public.garments enable row level security;

create policy "garments_select_own"
  on public.garments for select
  using (auth.uid() = user_id);

create policy "garments_insert_own"
  on public.garments for insert
  with check (auth.uid() = user_id);

create policy "garments_update_own"
  on public.garments for update
  using (auth.uid() = user_id);

create policy "garments_delete_own"
  on public.garments for delete
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 6. outfit_slots — RLS policies
-- ──────────────────────────────────────────────────────────────
alter table public.outfit_slots enable row level security;

create policy "outfit_slots_select_own"
  on public.outfit_slots for select
  using (auth.uid() = user_id);

create policy "outfit_slots_insert_own"
  on public.outfit_slots for insert
  with check (auth.uid() = user_id);

create policy "outfit_slots_update_own"
  on public.outfit_slots for update
  using (auth.uid() = user_id);

create policy "outfit_slots_delete_own"
  on public.outfit_slots for delete
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 7. vto_results — RLS policies
-- ──────────────────────────────────────────────────────────────
alter table public.vto_results enable row level security;

create policy "vto_results_select_own"
  on public.vto_results for select
  using (auth.uid() = user_id);

create policy "vto_results_insert_own"
  on public.vto_results for insert
  with check (auth.uid() = user_id);

create policy "vto_results_update_own"
  on public.vto_results for update
  using (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────
-- 8. user-models storage bucket — PRIVATE
--    Model photos are personal biometric data. The bucket is now
--    private; access is mediated by the API server which issues
--    short-lived signed URLs using the service-role key.
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-models',
  'user-models',
  false,          -- ← private (was: true in v1)
  10485760,       -- 10 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set public = false;  -- downgrade existing public bucket

-- Drop old v1 public-read policy if it exists
drop policy if exists "Public read model photos" on storage.objects;

-- Authenticated users may upload their own model photo
create policy "model_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Only the owning user or the service role may read (service role bypasses RLS)
create policy "model_photos_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'user-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner may update or delete their own photo
create policy "model_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'user-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "model_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'user-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ──────────────────────────────────────────────────────────────
-- 9. vto-results storage bucket
--    Stores processed VTO output images. Private by default.
-- ──────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vto-results',
  'vto-results',
  false,
  20971520,       -- 20 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

create policy "vto_results_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vto-results'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
