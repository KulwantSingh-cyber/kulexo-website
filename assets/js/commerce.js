import { SUPABASE_URL, requireSupabase } from "./supabase-client.js";

const functionNames = {
  checkout: "create-checkout-session",
  download: "create-download",
  recovery: "recover-guest-purchase"
};

function functionUrl(name) {
  const url = new URL(SUPABASE_URL);
  return `${url.origin}/functions/v1/${functionNames[name]}`;
}

async function invoke(name, body, authenticated = false) {
  const headers = { "content-type": "application/json" };
  if (authenticated) {
    const { data, error } = await requireSupabase().auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Please sign in before continuing.");
    headers.authorization = ["Bearer", data.session.access_token].join(" ");
  }
  const response = await fetch(functionUrl(name), {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The commerce service is unavailable.");
  return result;
}

export function createCheckoutSession(productKeys, email, authenticated = false) {
  return invoke("checkout", {
    product_keys: productKeys,
    checkout_request_id: crypto.randomUUID(),
    ...(email ? { email } : {})
  }, authenticated);
}

export function createAuthenticatedDownload(productId) {
  return invoke("download", { product_id: productId }, true);
}

export function createGuestDownload(token) {
  return invoke("download", { token });
}

export function requestPurchaseRecovery(email) {
  return invoke("recovery", { email });
}
