import type { Metadata } from "next";
import { staticNames } from "@/app/lib/site-names/registry";
import AdminWorkspace from "./admin-workspace";

export const metadata: Metadata = { title: staticNames["admin.heading"] };

export default function AdminPage() {
  return <AdminWorkspace />;
}
