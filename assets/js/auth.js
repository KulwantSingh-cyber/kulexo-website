import { isSupabaseConfigured, requireSupabase } from "./supabase-client.js";
import { migrateLocalSavedDesigns } from "./saved-designs.js";

const siteOrigin = "https://kulwantsingh-cyber.github.io/kulexo-website/";

export function safeRedirect(value, fallback = "account.html") {
  if (!value || !/^[a-z0-9-]+\.html(?:\?[^#]*)?(?:#[a-z0-9-]+)?$/i.test(value)) {
    return fallback;
  }
  return value;
}

export function authRedirectUrl(page) {
  return new URL(page, location.href).href;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return null;
  const { data: { user } } = await requireSupabase().auth.getUser();
  return user;
}

function navMarkup(user, ctaClass) {
  if (user) {
    return `<a href="account.html" class="login">Account</a><a href="#" class="${ctaClass}" data-auth-logout>Log out</a>`;
  }
  return `<a href="login.html" class="login">Log in</a><a href="signup.html" class="${ctaClass}">Sign up</a>`;
}

export async function initAuthNavigation() {
  const nav = document.querySelector("[data-auth-nav]");
  if (!nav) return;
  const ctaClass = nav.dataset.ctaClass || "btn btn-primary";

  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.warn("KULEXO auth navigation unavailable:", error);
  }
  nav.innerHTML = navMarkup(user, ctaClass);
  nav.querySelector("[data-auth-logout]")?.addEventListener("click", async event => {
    event.preventDefault();
    if (!isSupabaseConfigured) return;
    await requireSupabase().auth.signOut();
    location.assign("index.html");
  });
}

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (user) return user;
  const current = location.pathname.split("/").pop() || "account.html";
  location.replace(`login.html?redirect=${encodeURIComponent(safeRedirect(current))}`);
  return null;
}

export async function migrateSavedDesignsAfterAuth() {
  try {
    await migrateLocalSavedDesigns();
  } catch (error) {
    console.warn("KULEXO local saved designs were not migrated:", error);
  }
}

export async function handleLogin(form, message) {
  const email = form.email.value.trim();
  const password = form.password.value;
  const redirect = safeRedirect(new URLSearchParams(location.search).get("redirect"));
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  await migrateSavedDesignsAfterAuth();
  location.assign(redirect);
}

export async function handleSignup(form) {
  const email = form.email.value.trim();
  const password = form.password.value;
  const displayName = form.display_name.value.trim();
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: authRedirectUrl("login.html")
    }
  });
  if (error) throw error;
  if (data.session) await migrateSavedDesignsAfterAuth();
  return data.session
    ? "Your account is ready. Redirecting to your account…"
    : "Check your email to confirm your KULEXO account, then log in.";
}

export async function handleForgotPassword(form) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(
    form.email.value.trim(),
    { redirectTo: authRedirectUrl("reset-password.html") }
  );
  if (error) throw error;
}

export async function handleResetPassword(form) {
  const password = form.password.value;
  const confirmation = form.confirm_password.value;
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}

export { isSupabaseConfigured, siteOrigin };
