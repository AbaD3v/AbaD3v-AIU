"use client";
import { useSyncExternalStore } from "react";
import { cloudEnabled } from "../supabase/client";
import * as cloud from "./cloud-store";
import * as local from "./local-store";

export type { Account, Role } from "./local-store";
export { setupDemoAdmin } from "./local-store";
export { registerCloudStudent, resendCloudConfirmation } from "./cloud-store";

export const getAccounts = cloudEnabled ? cloud.getAccounts : local.getAccounts;
export const subscribeAccounts = cloudEnabled ? cloud.subscribeAccounts : local.subscribeAccounts;
export const refreshAccounts = cloudEnabled ? cloud.refreshAccounts : local.refreshAccounts;
export const registerStudent = local.registerStudent;
export const signIn = cloudEnabled ? cloud.signIn : local.signIn;
export const signOut = cloudEnabled ? cloud.signOut : local.signOut;
export const setStudentBlocked = cloudEnabled ? cloud.setStudentBlocked : local.setStudentBlocked;

export function useAccounts() {
  return useSyncExternalStore(subscribeAccounts, getAccounts, () => local.initial);
}
