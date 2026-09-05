-- KULEXO Phase 1: customer profiles and saved designs.
-- Run this migration in the Supabase SQL editor or with the Supabase CLI.
-- This file intentionally contains no project credentials or service-role key.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_designs (
  user_id uuid not null references auth.users(id) on delete cascade,
  design_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, design_id)
);

create index if not exists saved_designs_user_id_created_at_idx
  on public.saved_designs (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.saved_designs enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can view their own saved designs" on public.saved_designs;
create policy "Users can view their own saved designs"
  on public.saved_designs for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can save their own designs" on public.saved_designs;
create policy "Users can save their own designs"
  on public.saved_designs for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their own saved designs" on public.saved_designs;
create policy "Users can remove their own saved designs"
  on public.saved_designs for delete to authenticated
  using ((select auth.uid()) = user_id);
