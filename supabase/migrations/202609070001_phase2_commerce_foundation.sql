-- KULEXO Phase 2: commerce foundation.
-- Products, orders, entitlements, and recovery tokens are written only by future
-- server-side Edge Functions. This migration contains no credentials or secrets.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_key text not null unique,
  design_id text not null unique,
  name text not null,
  active boolean not null default true,
  stripe_price_id text not null unique,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  unit_amount integer not null check (unit_amount >= 0),
  storage_bucket text not null default 'paid-design-files',
  storage_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(product_key)) > 0),
  check (char_length(trim(design_id)) > 0),
  check (char_length(trim(storage_path)) > 0)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  amount_total integer not null check (amount_total >= 0),
  checkout_request_id uuid not null unique,
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_key text not null,
  product_name text not null,
  unit_amount integer not null check (unit_amount >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 20),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  created_at timestamptz not null default now(),
  unique (order_id, product_id)
);

create table if not exists public.download_entitlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  storage_bucket text not null default 'paid-design-files',
  storage_path text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (char_length(trim(storage_path)) > 0),
  check (
    (status = 'active' and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null)
  )
);

create table if not exists public.download_access_tokens (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.download_entitlements(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at),
  check (char_length(trim(token_hash)) >= 32)
);

create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.download_entitlements(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  delivery_type text not null check (delivery_type in ('account', 'guest_recovery', 'checkout_success')),
  created_at timestamptz not null default now()
);

create index if not exists products_active_design_id_idx
  on public.products (active, design_id);
create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc) where user_id is not null;
create index if not exists orders_customer_email_idx
  on public.orders (lower(customer_email)) where customer_email is not null;
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
create index if not exists download_entitlements_user_id_created_at_idx
  on public.download_entitlements (user_id, created_at desc) where user_id is not null;
create index if not exists download_entitlements_customer_email_status_idx
  on public.download_entitlements (lower(customer_email), status);
create index if not exists download_access_tokens_entitlement_id_idx
  on public.download_access_tokens (entitlement_id);
create index if not exists download_access_tokens_expires_at_idx
  on public.download_access_tokens (expires_at) where revoked_at is null;
create index if not exists download_events_entitlement_id_created_at_idx
  on public.download_events (entitlement_id, created_at desc);
create index if not exists download_events_user_id_created_at_idx
  on public.download_events (user_id, created_at desc) where user_id is not null;

-- Reuse the Phase 1 timestamp trigger function for mutable server-managed rows.
drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.download_entitlements enable row level security;
alter table public.download_access_tokens enable row level security;
alter table public.download_events enable row level security;

-- Do not rely on project-default privileges. Browser clients receive read-only
-- access to their own order history; all commerce writes remain server-only.
revoke all on public.products from anon, authenticated;
revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;
revoke all on public.download_entitlements from anon, authenticated;
revoke all on public.download_access_tokens from anon, authenticated;
revoke all on public.download_events from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select on public.download_events to authenticated;

drop policy if exists "Users can view their own orders" on public.orders;
create policy "Users can view their own orders"
  on public.orders for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can view items from their own orders" on public.order_items;
create policy "Users can view items from their own orders"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can view their own download history" on public.download_events;
create policy "Users can view their own download history"
  on public.download_events for select to authenticated
  using ((select auth.uid()) = user_id);

-- No browser policy is created for products, entitlements, recovery tokens, or
-- Storage objects. Entitlements contain private Storage paths and must only be
-- read by future server-side download functions.
-- Future Edge Functions use server-side credentials to manage products, checkout,
-- fulfillment, private file signing, recovery tokens, and download events.
