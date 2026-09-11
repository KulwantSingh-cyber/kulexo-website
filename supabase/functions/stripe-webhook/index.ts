import { configuredSiteOrigin, siteOrigin, stripeConfig } from "../_shared/config.ts";
import { adminClient } from "../_shared/supabase.ts";
import { stripeEventPayload } from "../_shared/stripe.ts";
import { sendResendEmail } from "../_shared/email.ts";
import { json, badRequest, notConfigured, preflight, serverError } from "../_shared/response.ts";

Deno.serve(async request => {
  let origin: string | undefined = configuredSiteOrigin();
  try {
    const config = stripeConfig();
    origin = siteOrigin(config.siteUrl);
    if (request.method === "OPTIONS") return preflight(origin);
    if (request.method !== "POST") return badRequest("Use POST.", origin);
    const signature = request.headers.get("stripe-signature");
    if (!signature) return badRequest("Missing Stripe signature.", origin);
    const event = await stripeEventPayload(await request.text(), signature, config.webhookSecret);
    const client = adminClient(config.supabaseUrl, config.serviceRoleKey);
    const handledEvents = [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "checkout.session.expired"
    ];
    if (!handledEvents.includes(event.type)) {
      return json({ received: true, ignored: true, staging: true }, 200, origin);
    }
    const session = event.data.object;
    const isPaid = (
      event.type === "checkout.session.async_payment_succeeded" ||
      (event.type === "checkout.session.completed" && session.payment_status === "paid")
    );
    const status = isPaid
      ? "paid"
      : event.type === "checkout.session.async_payment_failed"
        ? "failed"
        : event.type === "checkout.session.expired"
          ? "canceled"
          : "pending";
    const { data: existingOrder, error: existingOrderError } = await client
      .from("orders")
      .select("id,status,user_id,customer_email")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (existingOrderError) throw existingOrderError;
    if (!existingOrder) return badRequest("Unknown checkout session.", origin);
    if (!isPaid && existingOrder.status === "paid") {
      return json({ received: true, ignored: true, staging: true }, 200, origin);
    }
    const { data: order, error: orderError } = await client
      .from("orders")
      .update({
        status,
        stripe_payment_intent_id: session.payment_intent || null,
        stripe_customer_id: session.customer || null,
        fulfilled_at: status === "paid" ? new Date().toISOString() : null
      })
      .eq("stripe_checkout_session_id", session.id)
      .select("id,order_number,user_id,customer_email")
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return badRequest("Unknown checkout session.", origin);
    if (isPaid) {
      const shouldSendOrderEmail = existingOrder.status !== "paid";
      const { data: items, error: itemError } = await client
        .from("order_items")
        .select("id,product_id")
        .eq("order_id", order.id);
      if (itemError) throw itemError;
      for (const item of items || []) {
        const { data: product, error: productError } = await client
          .from("products")
          .select("storage_bucket,storage_path")
          .eq("id", item.product_id)
          .single();
        if (productError) throw productError;
        const { error: entitlementError } = await client
          .from("download_entitlements")
          .upsert({
            order_id: order.id,
            order_item_id: item.id,
            product_id: item.product_id,
            user_id: order.user_id,
            customer_email: order.customer_email,
            storage_bucket: product.storage_bucket,
            storage_path: product.storage_path
          }, { onConflict: "order_item_id", ignoreDuplicates: true });
        if (entitlementError) throw entitlementError;
      }
      const resendKey = Deno.env.get("RESEND_API_KEY")?.trim();
      const sender = Deno.env.get("RECOVERY_EMAIL_FROM")?.trim();
      if (shouldSendOrderEmail && resendKey && sender && order.customer_email) {
        try {
          await sendResendEmail(resendKey, {
            from: sender,
            to: [order.customer_email],
            subject: "Your KULEXO order is ready",
            text: [
              `Your KULEXO order ${order.order_number} is ready.`,
              "",
              `Sign in to view your secure downloads: ${config.siteUrl}/downloads.html`,
              `If you checked out as a guest, request a recovery link here: ${config.siteUrl}/purchase-recovery.html`
            ].join("\n"),
            html: [
              `<p>Your KULEXO order <strong>${order.order_number}</strong> is ready.</p>`,
              `<p><a href="${config.siteUrl}/downloads.html">Sign in to view your secure downloads</a>.</p>`,
              `<p>Checked out as a guest? <a href="${config.siteUrl}/purchase-recovery.html">Request a recovery link</a>.</p>`
            ].join("")
          });
        } catch (emailError) {
          console.error("KULEXO order confirmation email failed", emailError);
        }
      }
    }
    return json({ received: true, staging: true }, 200, origin);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing required")) {
      return notConfigured("Stripe webhook", error.message, origin);
    }
    console.error("stripe-webhook failed", error);
    return serverError(undefined, origin);
  }
});
