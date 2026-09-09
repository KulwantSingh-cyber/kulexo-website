const stripeHeaders = (secret: string) => ({
  authorization: `Bearer ${secret}`,
  "content-type": "application/x-www-form-urlencoded"
});

export async function stripeRequest(
  secret: string,
  path: string,
  params: Record<string, string>
) {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: stripeHeaders(secret),
    body
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe request failed (${response.status}).`);
  }
  return data;
}

export function stripeEventPayload(rawBody: string, signature: string, secret: string) {
  const parts = Object.fromEntries(signature.split(",").map(part => part.split("=")));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw new Error("Stripe webhook timestamp is outside the allowed tolerance.");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  ).then(async key => {
    const signed = `${timestamp}.${rawBody}`;
    const expected = parts.v1;
    if (!expected) throw new Error("Stripe webhook signature is missing.");
    const bytes = Uint8Array.from(expected.match(/.{2}/g) || [], value => parseInt(value, 16));
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      bytes,
      new TextEncoder().encode(signed)
    );
    if (!valid) throw new Error("Stripe webhook signature is invalid.");
    return JSON.parse(rawBody);
  });
}
