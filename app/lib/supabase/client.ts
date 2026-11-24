import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(url && key);

let client: SupabaseClient | undefined;

export function getSupabase() {
  if (typeof window === "undefined" || !url || !key) {
    throw new Error("Подключение к Supabase доступно в настроенном браузерном приложении.");
  }
  return client ??= createClient(url, key);
}
