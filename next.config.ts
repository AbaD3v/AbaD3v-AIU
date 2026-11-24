import type { NextConfig } from "next";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (Boolean(url) !== Boolean(key)) {
  throw new Error("Для Supabase укажите и URL проекта, и publishable key.");
}
if (key && !key.startsWith("sb_publishable_")) {
  throw new Error("В NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY требуется ключ sb_publishable_.");
}
if (url) {
  const endpoint = new URL(url);
  const local = endpoint.hostname === "localhost" || endpoint.hostname === "127.0.0.1";
  if (endpoint.protocol !== "https:" && !(local && endpoint.protocol === "http:")) {
    throw new Error("Укажите HTTPS-адрес проекта Supabase.");
  }
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  experimental: {
    agentFeedback: true,
  },
};

export default nextConfig;
