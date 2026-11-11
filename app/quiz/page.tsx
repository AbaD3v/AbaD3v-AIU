import { Suspense } from "react";
import QuizChat from "./quiz-chat";

export const metadata = { title: "Тест по SQL" };

export default function QuizPage() {
  return <Suspense fallback={<div className="page">Загрузка теста…</div>}><QuizChat /></Suspense>;
}
