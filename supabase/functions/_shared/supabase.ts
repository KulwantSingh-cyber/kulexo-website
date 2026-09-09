import { createClient } from "npm:@supabase/supabase-js@2";

export function adminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function userFromRequest(request: Request, url: string, serviceRoleKey: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length);
  const { data, error } = await adminClient(url, serviceRoleKey).auth.getUser(token);
  if (error) throw error;
  return data.user;
}
