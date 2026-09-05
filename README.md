# KULEXO Website

Static GitHub Pages frontend for the KULEXO design library. Phase 1 adds optional
customer accounts and saved designs using Supabase Auth and Postgres. Accounts are
not required for browsing designs; signed-out visitors can still use temporary
browser-local saved designs.

## Supabase public configuration

Before deploying account features, edit
[`assets/js/supabase-client.js`](assets/js/supabase-client.js) and replace:

```js
YOUR_SUPABASE_PROJECT_URL
YOUR_SUPABASE_PUBLISHABLE_KEY
```

Use values from **Supabase Dashboard → Settings → API**:

- Project URL
- Publishable key (or legacy anon key, if that is what the project provides)

These are the only Supabase values allowed in the GitHub Pages frontend. The app
remains in a safe “not configured” state until they are supplied.

## Database and RLS setup

Run [`supabase/migrations/202609050001_phase1_auth.sql`](supabase/migrations/202609050001_phase1_auth.sql)
in the Supabase SQL Editor, or apply it with the Supabase CLI. It creates:

- `profiles`, linked one-to-one with `auth.users`
- `saved_designs`, keyed by `(user_id, design_id)`
- a trigger that creates a profile when a customer signs up
- an index for a customer’s saved-design list
- Row Level Security policies that limit profiles and saved designs to `auth.uid()`

The migration intentionally does **not** create a browser insert policy for
`profiles`; the signup trigger is responsible for it. Do not disable RLS or add
anonymous/public access policies.

## Authentication setup

In **Supabase Dashboard → Authentication**:

1. Keep email/password authentication enabled.
2. Require email confirmation for signups.
3. Keep anonymous, phone, and social providers disabled for Phase 1.
4. Set Site URL to:

   ```text
   https://kulwantsingh-cyber.github.io/kulexo-website/
   ```

5. Add these Redirect URLs:

   ```text
   https://kulwantsingh-cyber.github.io/kulexo-website/login.html
   https://kulwantsingh-cyber.github.io/kulexo-website/reset-password.html
   https://kulwantsingh-cyber.github.io/kulexo-website/account.html
   ```

6. For local development, add the exact local-server URLs you use, for example:

   ```text
   http://localhost:5500/login.html
   http://localhost:5500/reset-password.html
   http://localhost:5500/account.html
   ```

Configure a custom SMTP provider before public launch so verification and reset
emails use a trusted KULEXO sender.

## Local testing

Test through a local HTTP server, not by double-clicking files with `file://` URLs.
After configuring a development Supabase project, test signup and confirmation,
login/logout, password reset, saving/removing designs, migration of guest local
saves after login, and access to `account.html` while signed in and signed out.

## GitHub Pages deployment

GitHub Pages serves the frontend only. Supabase provides Auth and Postgres remotely;
there is no backend process to deploy with Phase 1. Before deployment, ensure the
production Site URL and redirect URLs above are configured in Supabase.

## Secrets: never commit these

Never put any of these values in this repository, GitHub Pages JavaScript, HTML, or
client-visible configuration:

- Supabase service-role key
- Supabase database password
- Supabase access tokens
- Stripe secret keys or webhook secrets
- Email-provider/SMTP API keys
- Private storage credentials or signing keys

Future payments, protected downloads, webhooks, and email delivery must run in
server-side Supabase Edge Functions with secrets configured in Supabase—not in this
static website.
