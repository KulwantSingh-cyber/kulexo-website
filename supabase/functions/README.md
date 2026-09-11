# KULEXO Edge Functions

These functions are intentionally scaffolded without credentials or live payment behavior.
They must be deployed only after product prices, Stripe configuration, a private paid-file
bucket, and Supabase secrets are available.

Required server-side secrets are configured in Supabase, never in this repository:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COMMERCE_MODE=staging`
- `SITE_URL`
- `RESEND_API_KEY`
- `RECOVERY_EMAIL_FROM`

`COMMERCE_MODE=staging` is mandatory for this phase. The download and recovery
functions use only the base secrets above. The checkout and webhook functions
additionally require:

- `STRIPE_SECRET_KEY` beginning with `sk_test_`
- `STRIPE_WEBHOOK_SECRET`

The functions reject live-mode keys.

For a no-Stripe staging download test, apply
`202609090001_staging_download_without_stripe.sql` only to the staging project.
The test object path is:

- Bucket: `paid-design-files`
- Path: `products/kulexo-003/MUTLI CLUB MIX.rar`

Each function must validate inputs against `public.products`, use idempotency for retries,
and keep private storage paths and recovery token hashes out of browser responses.

The current staging implementation expects configured `public.products` rows and a
private Storage bucket. It does not use catalogue prices or client-supplied amounts.

Resend is used only from server-side functions. `recover-guest-purchase` sends
short-lived, one-time recovery links after it creates their hashed tokens.
After paid entitlement fulfillment, `stripe-webhook` sends an order-ready email
when `RESEND_API_KEY` and `RECOVERY_EMAIL_FROM` are configured. A Resend failure
is logged without changing the already-completed payment or entitlement state.
