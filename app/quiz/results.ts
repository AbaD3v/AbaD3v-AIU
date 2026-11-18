import { getTask } from "../lib/sql/course";
import type { QuizQuestion } from "../lib/sql/quiz";
import { getStudyScope } from "../lib/sql/store";

export type QuizResult = { score: number; questionCount: number; completedAt: string };

export function quizResultKey(taskId: string, scope = getStudyScope()) {
  return `codeproof.quiz-results.v1.${scope}.${taskId}`;
}

export function readQuizResult(taskId: string, scope = getStudyScope()): QuizResult | null {
  if (!getTask(taskId) || typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(quizResultKey(taskId, scope)) ?? "null");
    if (!value || !Number.isInteger(value.score) || !Number.isInteger(value.questionCount) ||
      value.questionCount < 1 || value.score < 0 || value.score > value.questionCount ||
      typeof value.completedAt !== "string" || !Number.isFinite(Date.parse(value.completedAt))) return null;
    return { score: value.score, questionCount: value.questionCount, completedAt: value.completedAt };
  } catch { return null; }
}

/** Incomplete attempts never write; failed writes still return the current result. */
export function completeQuiz(taskId: string, questions: QuizQuestion[], answers: number[], scope = getStudyScope()) {
  if (!getTask(taskId) || !questions.length || answers.length !== questions.length ||
    Array.from(answers).some((answer, index) => !Number.isInteger(answer) || answer < 0 || answer >= questions[index].options.length))
    throw new Error("Попытка не завершена.");
  const result: QuizResult = {
    score: answers.reduce((sum, answer, index) => sum + Number(answer === questions[index].correctIndex), 0),
    questionCount: questions.length,
    completedAt: new Date().toISOString(),
  };
  let saved = false;
  // A stale click after switching accounts must never write to another user's scope.
  if (scope === getStudyScope()) {
    try {
      window.localStorage.setItem(quizResultKey(taskId, scope), JSON.stringify(result));
      saved = true;
    } catch { /* The caller displays the in-memory result. */ }
  }
  return { result, saved };
}
