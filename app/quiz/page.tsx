import { Suspense } from "react";
import QuizChat from "./quiz-chat";
import { staticNames } from "../lib/site-names/registry";

export const metadata = { title: staticNames["quiz.heading"] };

export default function QuizPage() {
  return <Suspense fallback={<div className="page">Загрузка теста…</div>}><QuizChat /></Suspense>;
}
