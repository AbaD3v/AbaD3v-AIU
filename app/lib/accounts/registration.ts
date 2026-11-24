import { getTask, taskHref } from "../sql/course";
import type { Role } from "./local-store";

const returnKey = "codeproof.registration-task.v1";
const addressTypos = new Map([
  ["gmial.com", "gmail.com"],
  ["gmal.com", "gmail.com"],
  ["gmai.com", "gmail.com"],
  ["gamil.com", "gmail.com"],
  ["hotmial.com", "hotmail.com"],
  ["outlok.com", "outlook.com"],
]);

export function suggestEmailAddress(address: string) {
  const email = address.trim();
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@") || /\s/.test(email)) return null;
  const domain = addressTypos.get(email.slice(at + 1).toLowerCase());
  return domain ? email.slice(0, at + 1) + domain : null;
}

export function practiceAccountHref(pathname: string) {
  const id = /^\/practice\/([a-z0-9-]+)\/?$/.exec(pathname)?.[1];
  return id && getTask(id) ? `/account/?task=${encodeURIComponent(id)}` : "/account/";
}

export function rememberRegistrationTask(email: string) {
  const id = new URLSearchParams(window.location.search).get("task");
  if (!id || !getTask(id)) return;
  try {
    window.localStorage.setItem(returnKey, JSON.stringify({ email: email.trim().toLowerCase(), id }));
  } catch {
    // Registration still works in browsers that block local storage.
  }
}

export function accountDestination(role: Role, email: string) {
  if (role === "admin") return "/admin/";
  const id = new URLSearchParams(window.location.search).get("task");
  let remembered: string | undefined;
  try {
    const saved = JSON.parse(window.localStorage.getItem(returnKey) ?? "null");
    if (saved?.email === email.trim().toLowerCase()) {
      if (typeof saved.id === "string") remembered = saved.id;
      window.localStorage.removeItem(returnKey);
    }
  } catch {
    // A task in the current URL is still available.
  }
  if (id && getTask(id)) return taskHref(id);
  return remembered && getTask(remembered) ? taskHref(remembered) : "/profile/";
}
