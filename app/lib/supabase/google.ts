import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getTask } from "../sql/course";
import { getSupabase, supabasePublishableKey, supabaseUrl } from "./client";

const flowKey = "codeproof-google-oauth";
const verifierKey = `${flowKey}-code-verifier`;
const intentKey = `${flowKey}-task`;

type GoogleReturn =
  | { status: "signed-in"; userId: string; task: string | null }
  | { status: "cancelled" | "failed" };

let googleClient: SupabaseClient | undefined;
let completion: Promise<GoogleReturn> | undefined;

function getGoogleClient() {
  if (!supabaseUrl || !supabasePublishableKey) throw new Error("Вход через Google пока недоступен.");
  return googleClient ??= createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      flowType: "pkce",
      storageKey: flowKey,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      // Only the PKCE verifier survives the redirect. The main client owns the session.
      storage: {
        getItem: (name) => name === verifierKey ? window.sessionStorage.getItem(name) : null,
        setItem: (name, value) => { if (name === verifierKey) window.sessionStorage.setItem(name, value); },
        removeItem: (name) => { if (name === verifierKey) window.sessionStorage.removeItem(name); },
      },
    },
  });
}

export async function googleSignInEnabled(signal: AbortSignal) {
  if (!supabaseUrl || !supabasePublishableKey) return false;
  try {
    const response = await fetch(new URL("/auth/v1/settings", supabaseUrl), {
      headers: { apikey: supabasePublishableKey },
      cache: "no-store",
      signal,
    });
    if (!response.ok) return false;
    const settings: { external?: { google?: boolean } } | null = await response.json();
    return settings?.external?.google === true;
  } catch {
    return false;
  }
}

export async function startGoogleSignIn() {
  const task = new URLSearchParams(window.location.search).get("task");
  try {
    window.sessionStorage.setItem(intentKey, task && getTask(task) ? task : "");
  } catch {
    throw new Error("Разрешите сайту сохранять данные вкладки и повторите вход через Google.");
  }

  try {
    const { data, error } = await getGoogleClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL("/account/", window.location.origin).href,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url) throw new Error("Не удалось начать вход через Google.");
    window.location.assign(data.url);
  } catch {
    clearGoogleIntent();
    throw new Error("Не удалось открыть вход через Google. Попробуйте ещё раз.");
  }
}

function clearGoogleIntent() {
  try {
    window.sessionStorage.removeItem(intentKey);
    window.sessionStorage.removeItem(verifierKey);
  } catch {
    // The redirect is unavailable if browser storage is disabled.
  }
}

async function exchangeGoogleCode(code: string, task: string): Promise<GoogleReturn> {
  const { data, error } = await getGoogleClient().auth.exchangeCodeForSession(code);
  if (error || !data.session) return { status: "failed" };
  const { access_token, refresh_token } = data.session;
  const loggedIn = await getSupabase().auth.setSession({ access_token, refresh_token });
  return loggedIn.error || !loggedIn.data.user
    ? { status: "failed" }
    : { status: "signed-in", userId: loggedIn.data.user.id, task: task && getTask(task) ? task : null };
}

export function readGoogleReturn() {
  if (completion) return completion;

  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = url.searchParams.get("code");
  const queryError = url.searchParams.get("error");
  const hashError = hash.get("error");
  let intent: string | null = null;
  try { intent = window.sessionStorage.getItem(intentKey); } catch { /* A code without a verifier cannot be used. */ }
  if (!code && (intent === null || (!queryError && !hashError))) return null;

  for (const key of ["code", "error", "error_code", "error_description"]) url.searchParams.delete(key);
  if (hashError) url.hash = "";
  window.history.replaceState(window.history.state, "", url);
  completion = (
    code && intent !== null
      ? exchangeGoogleCode(code, intent)
      : Promise.resolve<GoogleReturn>({
          status: queryError === "access_denied" || hashError === "access_denied" ? "cancelled" : "failed",
        })
  ).catch((): GoogleReturn => ({ status: "failed" })).finally(clearGoogleIntent);
  return completion;
}

export function dismissGoogleReturn() {
  completion = undefined;
}
