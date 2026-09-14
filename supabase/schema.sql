-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- One row per signed-in user holding the whole progress document.

create table if not exists public.progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "owner can read" on public.progress
  for select using (auth.uid() = user_id);
create policy "owner can insert" on public.progress
  for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.progress
  for update using (auth.uid() = user_id);
create policy "owner can delete" on public.progress
  for delete using (auth.uid() = user_id);
