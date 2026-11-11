import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tasks, getTask } from "@/app/lib/sql/course";
import Workspace from "@/app/components/sql/workspace";
export function generateStaticParams() {
  return tasks.map((task) => ({ id: task.id }));
}
export const dynamicParams = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: getTask(id)?.title ?? "Задание" };
}
export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!getTask(id)) notFound();
  return <Workspace key={id} taskId={id} />;
}
