-- FitWeek — Supabase setup
-- Paste this entire file into the Supabase SQL Editor and click Run.
-- Dashboard → SQL Editor → New query

-- ──────────────────────────────────────────────────────
-- 1. users table (synced from auth.users on sign-in)
-- ──────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  model_image_url text,
  created_at  timestamptz default now() not null
);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Each user can only read/write their own row
create policy "Users can view own row"   on public.users for select using (auth.uid() = id);
create policy "Users can insert own row" on public.users for insert with check (auth.uid() = id);
create policy "Users can update own row" on public.users for update using (auth.uid() = id);

-- ──────────────────────────────────────────────────────
-- 2. user-models storage bucket
-- ──────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-models',
  'user-models',
  true,
  10485760,   -- 10 MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own model photo
create policy "Auth users can upload model photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'user-models' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Anyone can read model photos (needed for VTO)
create policy "Public read model photos"
  on storage.objects for select
  using (bucket_id = 'user-models');

-- Users can update/delete their own photo
create policy "Auth users can update own model photo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'user-models' AND auth.uid()::text = (storage.foldername(name))[2]);
