-- KULEXO staging-only download fixture support.
-- Do not apply this migration to production. Checkout still requires a real
-- Stripe Price ID through the Stripe-dependent Edge Function configuration.

alter table public.products
  alter column stripe_price_id drop not null;
