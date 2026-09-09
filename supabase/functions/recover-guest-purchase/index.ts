import { configuredSiteOrigin, siteOrigin, stagingConfig, requiredEnv } from "../_shared/config.ts";
import { adminClient } from "../_shared/supabase.ts";
import { hashToken, randomToken } from "../_shared/tokens.ts";
import { badRequest, json, notConfigured, preflight, serverError } from "../_shared/response.ts";

Deno.serve(async request => {
  let origin: string | undefined = configuredSiteOrigin();
  try {
    const config = stagingConfig();
    origin = siteOrigin(config.siteUrl);
    if (request.method === "OPTIONS") return preflight(origin);
    if (request.method !== "POST") return badRequest("Use POST.", origin);
    const resendKey = requiredEnv("RESEND_API_KEY");
    const sender = requiredEnv("RECOVERY_EMAIL_FROM");
    const siteUrl = config.siteUrl;
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return badRequest("A valid purchase email is required.", origin);
    const client = adminClient(config.supabaseUrl, config.serviceRoleKey);
    const { data: entitlements, error } = await client
      .from("download_entitlements")
      .select("id")
      .eq("customer_email", email)
      .eq("status", "active");
    if (error) throw error;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const recoveryLinks = [];
    for (const entitlement of entitlements || []) {
      const token = randomToken();
      const tokenHash = await hashToken(token);
      const { error: tokenError } = await client.from("download_access_tokens").insert({
        entitlement_id: entitlement.id,
        token_hash: tokenHash,
        expires_at: expiresAt
      });
      if (tokenError) throw tokenError;
      recoveryLinks.push(`${siteUrl}/purchase-recovery.html?token=${encodeURIComponent(token)}`);
    }
    if (entitlements?.length) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: sender,
          to: [email],
          subject: "Your KULEXO staging download link",
          html: `<p>Use a staging download link within 30 minutes:</p>${recoveryLinks.map(link => `<p><a href="${link}">${link}</a></p>`).join("")}`
        })
      });
      if (!emailResponse.ok) throw new Error("Recovery email provider rejected the request.");
    }
    return json({ accepted: true, staging: true }, 200, origin);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing required")) {
      return notConfigured("Purchase recovery", error.message, origin);
    }
    console.error("recover-guest-purchase failed", error);
    return serverError(undefined, origin);
  }
});
