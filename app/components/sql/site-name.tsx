"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSiteNames } from "@/app/lib/site-names/store";
import { brandName, type NameKey } from "@/app/lib/site-names/registry";
import { getTask } from "@/app/lib/sql/course";

export function SiteName({ nameKey }: { nameKey: NameKey }) {
  const name = useSiteNames();
  return name(nameKey);
}

export function SiteBrand({ uppercase = false }: { uppercase?: boolean }) {
  const name = useSiteNames();
  const brand = brandName(name("site.name"));
  return uppercase ? brand.toLocaleUpperCase("ru") : brand;
}

export function SiteDocumentTitle() {
  const name = useSiteNames();
  const pathname = usePathname();
  const quizTaskId = useSearchParams().get("task") ?? "";
  const site = name("site.name");
  const [, route, taskId] = pathname.split("/");
  let pageTitle = "";
  if (route === "practice" && taskId && getTask(taskId)) pageTitle = name(`task.${taskId}`);
  if (route === "quiz") pageTitle = getTask(quizTaskId) ? name(`quiz.title.${quizTaskId}`) : name("quiz.heading");
  if (route === "about") pageTitle = name("nav.about");
  const title = pageTitle ? `${pageTitle} · ${site}` : `${site} — ${name("site.tabTagline")}`;

  useEffect(() => {
    function applyTitle() {
      if (document.title !== title) document.title = title;
    }

    // The static App Router metadata can finish hydrating after this effect.
    const observer = new MutationObserver(applyTitle);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    applyTitle();
    return () => observer.disconnect();
  }, [pathname, title]);

  return null;
}
