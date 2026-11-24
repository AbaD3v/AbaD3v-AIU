import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(supabaseUrl && supabasePublishableKey);

type EmailRedirect = "signup" | "recovery" | "expired" | "invalid";
const recoveryKey = "codeproof.password-recovery";
let client: SupabaseClient | undefined;
let emailRedirect: EmailRedirect | null = null;
let recoverySessionId: string | null = null;

function sessionIdFromToken(token: string) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(payload));
    return typeof claims.session_id === "string" ? claims.session_id : null;
  } catch {
    return null;
  }
}

function captureEmailRedirect() {
  const { pathname, hash } = window.location;
  if (pathname !== "/account" && pathname !== "/account/") return;
  const params = new URLSearchParams(hash.slice(1));
  const errorCode = params.get("error_code");
  if (params.has("error") && errorCode) {
    emailRedirect = errorCode === "otp_expired" ? "expired" : "invalid";
    return;
  }

  const type = params.get("type");
  const token = params.get("access_token");
  if (!token || (type !== "signup" && type !== "recovery")) return;
  emailRedirect = type;
  if (type === "recovery") {
    clearPasswordRecovery();
    recoverySessionId = sessionIdFromToken(token);
  }
}

export function getSupabase() {
  if (typeof window === "undefined" || !supabaseUrl || !supabasePublishableKey) {
    throw new Error("Подключение к Supabase доступно в настроенном браузерном приложении.");
  }
  if (!client) {
    captureEmailRedirect();
    client = createClient(supabaseUrl, supabasePublishableKey);
  }
  return client;
}

function storedRecoverySession() {
  try {
    return window.sessionStorage.getItem(recoveryKey);
  } catch {
    return null;
  }
}

export function clearPasswordRecovery() {
  recoverySessionId = null;
  try {
    window.sessionStorage.removeItem(recoveryKey);
  } catch {
    // The same-tab fallback only uses memory.
  }
}

export async function hasPasswordRecoverySession() {
  const expected = recoverySessionId ?? storedRecoverySession();
  if (!expected) return false;
  const { data, error } = await getSupabase().auth.getClaims();
  if (error || data?.claims.session_id !== expected) {
    if (!error || error.name === "AuthSessionMissingError") clearPasswordRecovery();
    return false;
  }
  recoverySessionId = expected;
  try {
    window.sessionStorage.setItem(recoveryKey, expected);
  } catch {
    // The confirmation can still be completed in this tab.
  }
  return true;
}

export async function readEmailConfirmation() {
  const supabase = getSupabase();
  const redirect = emailRedirect;
  if (redirect === "expired" || redirect === "invalid") return redirect;
  if (redirect) {
    const { error } = await supabase.auth.initialize();
    if (error) {
      if (redirect === "recovery") clearPasswordRecovery();
      return "invalid";
    }
    if (redirect === "signup") {
      clearPasswordRecovery();
      return "confirmed";
    }
    return await hasPasswordRecoverySession() ? "recovery" : "invalid";
  }
  return await hasPasswordRecoverySession() ? "recovery" : null;
}

export function dismissEmailConfirmation() {
  const handledRedirect = emailRedirect !== null;
  emailRedirect = null;
  if (handledRedirect && window.location.hash) {
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
  }
}
