import { configuredSiteOrigin, siteOrigin, stripeConfig } from "../_shared/config.ts";
import { adminClient, userFromRequest } from "../_shared/supabase.ts";
import { stripeRequest } from "../_shared/stripe.ts";
import { badRequest, json, notConfigured, preflight, serverError } from "../_shared/response.ts";

Deno.serve(async request => {
  let origin: string | undefined = configuredSiteOrigin();
  try {
    const config = stripeConfig();
    origin = siteOrigin(config.siteUrl);
    if (request.method === "OPTIONS") return preflight(origin);
    if (request.method !== "POST") return badRequest("Use POST.", origin);
    const client = adminClient(config.supabaseUrl, config.serviceRoleKey);
    const user = await userFromRequest(request, config.supabaseUrl, config.serviceRoleKey);
    const body = await request.json();
    const productKeys = Array.isArray(body.product_keys)
      ? [...new Set(body.product_keys)].filter(value => typeof value === "string")
      : [];
    const checkoutRequestId = body.checkout_request_id;
    const requestedEmail = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : null;
    const email = user?.email?.trim().toLowerCase() || requestedEmail;
    if (!productKeys.length || productKeys.length > 20 || !checkoutRequestId || !email) {
      return badRequest("product_keys, checkout_request_id, and a customer email are required.", origin);
    }

    const { data: products, error: productError } = await client
      .from("products")
      .select("id,product_key,name,stripe_price_id,currency,unit_amount")
      .in("product_key", productKeys)
      .eq("active", true);
    if (productError) throw productError;
    if (!products?.length || products.length !== productKeys.length) {
      return badRequest("One or more products are not configured for staging checkout.", origin);
    }

    const orderNumber = `STG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const currency = products[0].currency;
    if (products.some(product => product.currency !== currency || !product.stripe_price_id?.startsWith("price_"))) {
      return badRequest("Products must have configured Stripe Price IDs and one shared currency.", origin);
    }
    const amountTotal = products.reduce((total, product) => total + product.unit_amount, 0);
    const { data: order, error: orderError } = await client
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: user?.id || null,
        customer_email: email,
        currency,
        amount_total: amountTotal,
        checkout_request_id: checkoutRequestId
      })
      .select("id")
      .single();
    if (orderError) throw orderError;

    const { error: itemError } = await client.from("order_items").insert(
      products.map(product => ({
        order_id: order.id,
        product_id: product.id,
        product_key: product.product_key,
        product_name: product.name,
        unit_amount: product.unit_amount,
        quantity: 1,
        currency: product.currency
      }))
    );
    if (itemError) throw itemError;

    const params: Record<string, string> = {
      mode: "payment",
      customer_email: email,
      "metadata[order_id]": order.id,
      "metadata[checkout_request_id]": checkoutRequestId,
      success_url: `${config.siteUrl}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.siteUrl}/order-cancel.html?order=${orderNumber}`
    };
    products.forEach((product, index) => {
      params[`line_items[${index}][price]`] = product.stripe_price_id;
      params[`line_items[${index}][quantity]`] = "1";
    });
    const session = await stripeRequest(config.stripeKey, "checkout/sessions", params);
    const { error: updateError } = await client
      .from("orders")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", order.id);
    if (updateError) throw updateError;
    return json({ checkout_url: session.url, session_id: session.id, staging: true }, 200, origin);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing required")) {
      return notConfigured("Checkout", error.message, origin);
    }
    console.error("create-checkout-session failed", error);
    return serverError(undefined, origin);
  }
});
