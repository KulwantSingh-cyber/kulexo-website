import { configuredSiteOrigin, siteOrigin, stagingConfig } from "../_shared/config.ts";
import { adminClient, userFromRequest } from "../_shared/supabase.ts";
import { hashToken } from "../_shared/tokens.ts";
import { badRequest, json, notConfigured, preflight, serverError, unauthorized } from "../_shared/response.ts";

Deno.serve(async request => {
  let origin: string | undefined = configuredSiteOrigin();
  try {
    const config = stagingConfig();
    origin = siteOrigin(config.siteUrl);
    if (request.method === "OPTIONS") return preflight(origin);
    if (request.method !== "POST") return badRequest("Use POST.", origin);
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : null;
    const user = await userFromRequest(request, config.supabaseUrl, config.serviceRoleKey);
    const productId = typeof body.product_id === "string" ? body.product_id : null;
    if (!user && !token) return unauthorized(origin);
    if (user && !productId) return badRequest("product_id is required for account downloads.", origin);
    const client = adminClient(config.supabaseUrl, config.serviceRoleKey);
    let query = client
      .from("download_entitlements")
      .select("id,order_id,user_id,storage_bucket,storage_path")
      .eq("status", "active");
    if (user) query = query.eq("user_id", user.id).eq("product_id", productId);
    else {
      const tokenHash = await hashToken(token);
      const { data: tokenRow, error: tokenError } = await client
        .from("download_access_tokens")
        .update({ last_used_at: new Date().toISOString() })
        .eq("token_hash", tokenHash)
        .is("revoked_at", null)
        .is("last_used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("entitlement_id")
        .single();
      if (tokenError || !tokenRow) return unauthorized(origin);
      query = query.eq("id", tokenRow.entitlement_id);
    }
    const { data: entitlement, error } = await query.single();
    if (error || !entitlement) return unauthorized(origin);
    const { data: signed, error: signedError } = await client.storage
      .from(entitlement.storage_bucket)
      .createSignedUrl(entitlement.storage_path, 300);
    if (signedError) throw signedError;
    const { error: eventError } = await client.from("download_events").insert({
      entitlement_id: entitlement.id,
      order_id: entitlement.order_id,
      user_id: entitlement.user_id,
      delivery_type: user ? "account" : "guest_recovery"
    });
    if (eventError) throw eventError;
    return json({ download_url: signed.signedUrl, expires_in: 300, staging: true }, 200, origin);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing required")) {
      return notConfigured("Secure downloads", error.message, origin);
    }
    console.error("create-download failed", error);
    return serverError(undefined, origin);
  }
});
