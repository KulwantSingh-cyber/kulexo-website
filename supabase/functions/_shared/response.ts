export function json(
  body: Record<string, unknown>,
  status = 200,
  origin?: string
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(origin ? {
        "access-control-allow-origin": origin,
        "access-control-allow-headers": "authorization, content-type, stripe-signature",
        "access-control-allow-methods": "POST, OPTIONS"
      } : {})
    }
  });
}

export function notConfigured(name: string, detail?: string, origin?: string) {
  return json({
    error: detail || `${name} is not configured. Payments and protected downloads are disabled.`
  }, 503, origin);
}

export function badRequest(message: string, origin?: string) {
  return json({ error: message }, 400, origin);
}

export function preflight(origin: string) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type, stripe-signature",
      "access-control-allow-methods": "POST, OPTIONS"
    }
  });
}

export function unauthorized(origin?: string) {
  return json({ error: "Authentication is required." }, 401, origin);
}

export function serverError(
  message = "The KULEXO commerce service is unavailable.",
  origin?: string
) {
  return json({ error: message }, 500, origin);
}
