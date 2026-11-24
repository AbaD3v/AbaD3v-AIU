import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(url && key);

let client: SupabaseClient | undefined;
let signupRedirect = false;

export function getSupabase() {
  if (typeof window === "undefined" || !url || !key) {
    throw new Error("Подключение к Supabase доступно в настроенном браузерном приложении.");
  }
  if (!client) {
    const { pathname, hash } = window.location;
    const params = new URLSearchParams(hash.slice(1));
    signupRedirect = (pathname === "/account" || pathname === "/account/") &&
      ((params.get("type") === "signup" && params.has("access_token")) ||
        (params.has("error") && params.has("error_code")));
    client = createClient(url, key);
  }
  return client;
}

export async function readEmailConfirmation() {
  const supabase = getSupabase();
  if (!signupRedirect) return null;
  const { error } = await supabase.auth.initialize();
  if (!error) return "confirmed";
  const code = new URLSearchParams(window.location.hash.slice(1)).get("error_code");
  return code === "otp_expired" ? "expired" : "invalid";
}

export function dismissEmailConfirmation() {
  signupRedirect = false;
  if (window.location.hash) {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  }
}
