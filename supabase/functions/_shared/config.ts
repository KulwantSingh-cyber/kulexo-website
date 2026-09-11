export function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function stagingConfig() {
  const mode = requiredEnv("COMMERCE_MODE");
  if (mode !== "staging") {
    throw new Error("Commerce functions require COMMERCE_MODE=staging.");
  }
  return {
    mode,
    supabaseUrl: requiredEnv("SUPABASE_URL"),
    serviceRoleKey: requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    siteUrl: requiredEnv("SITE_URL").replace(/\/+$/, "")
  };
}

export function stripeConfig() {
  const config = stagingConfig();
  const stripeKey = requiredEnv("STRIPE_SECRET_KEY");
  if (!stripeKey.startsWith("sk_test_")) {
    throw new Error("Stripe commerce functions require a Stripe test-mode secret key.");
  }
  return {
    ...config,
    stripeKey,
    webhookSecret: requiredEnv("STRIPE_WEBHOOK_SECRET")
  };
}

export function siteOrigin(siteUrl: string) {
  return new URL(siteUrl).origin;
}

export function configuredSiteOrigin() {
  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  if (!siteUrl) return undefined;
  try {
    return siteOrigin(siteUrl.replace(/\/+$/, ""));
  } catch {
    return undefined;
  }
}
