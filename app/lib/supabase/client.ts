import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(url && key);

let client: SupabaseClient | undefined;
let signupRedirect: "signup" | "expired" | "invalid" | null = null;

export function getSupabase() {
  if (typeof window === "undefined" || !url || !key) {
    throw new Error("Подключение к Supabase доступно в настроенном браузерном приложении.");
  }
  if (!client) {
    const { pathname, hash } = window.location;
    if (pathname === "/account" || pathname === "/account/") {
      const params = new URLSearchParams(hash.slice(1));
      const errorCode = params.get("error_code");
      if (params.has("error") && errorCode) {
        signupRedirect = errorCode === "otp_expired" ? "expired" : "invalid";
      } else if (params.get("type") === "signup" && params.has("access_token")) {
        signupRedirect = "signup";
      }
    }
    client = createClient(url, key);
  }
  return client;
}

export async function readEmailConfirmation() {
  const supabase = getSupabase();
  if (signupRedirect !== "signup") return signupRedirect;
  const { error } = await supabase.auth.initialize();
  return error ? "invalid" : "confirmed";
}

export function dismissEmailConfirmation() {
  signupRedirect = null;
  if (window.location.hash) {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  }
}
