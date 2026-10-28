import type { LearnerProfile } from "./onboarding";

export type CodeRange = { lineStart: number; lineEnd: number };
export type TrainingQuestion = CodeRange & {
  id: string;
  number: number;
  text: string;
  modifiedCode?: string;
};
export type Training = {
  id: string;
  title: string;
  language: string;
  overview: string;
  sections: (CodeRange & { title: string; explanation: string })[];
  questionCount: 5;
  firstQuestion: TrainingQuestion;
};
export type Feedback = { score: number; summary: string; explanation: string };
export type AnswerResult = {
  feedback: Feedback;
  nextQuestion: TrainingQuestion | null;
  complete: boolean;
};

type ObjectValue = Record<string, unknown>;
function object(v: unknown): v is ObjectValue {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function text(v: unknown, max = 10000): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
function range(v: ObjectValue, lines: number) {
  return (
    Number.isInteger(v.lineStart) &&
    Number.isInteger(v.lineEnd) &&
    (v.lineStart as number) >= 1 &&
    (v.lineEnd as number) >= (v.lineStart as number) &&
    (v.lineEnd as number) <= lines
  );
}
function question(
  v: unknown,
  lines: number,
  number: number,
): v is TrainingQuestion {
  return (
    object(v) &&
    text(v.id, 200) &&
    v.number === number &&
    text(v.text) &&
    range(v, lines) &&
    (v.modifiedCode === undefined || text(v.modifiedCode))
  );
}

async function post(
  path: string,
  body: unknown,
  requestId: string,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": requestId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    });
  } catch (error) {
    if (signal.aborted)
      throw new Error(
        "Запрос отменён. Твой код и ответы остались на странице.",
      );
    if (error instanceof DOMException && error.name === "TimeoutError")
      throw new Error(
        "Подготовка заняла больше минуты. Попробуй повторить запрос.",
      );
    throw new Error(
      "Не удалось связаться с сервером. Проверь соединение и попробуй снова.",
    );
  }
  if (!response.ok) {
    if (response.status === 404 || response.status === 501)
      throw new Error(
        "ИИ пока не подключён: серверный маршрут недоступен. Код сохранён в поле — можно попробовать позже.",
      );
    if (response.status === 401)
      throw new Error(
        "Для продолжения нужна активная сессия. Авторизация на сервере пока недоступна или завершилась.",
      );
    if (response.status === 429)
      throw new Error(
        "Слишком много запросов. Подожди немного и попробуй ещё раз.",
      );
    if (response.status === 400 || response.status === 422)
      throw new Error(
        "Не удалось разобрать этот фрагмент. Проверь, что вставлен программный код целиком.",
      );
    throw new Error(
      "Сервис разбора временно недоступен. Попробуй ещё раз; введённые данные остались на странице.",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ. Повтори запрос.");
  }
}
export async function createTraining(
  code: string,
  profile: LearnerProfile,
  requestId: string,
  signal: AbortSignal,
): Promise<Training> {
  const v = await post(
    "/api/trainings",
    { code, onboardingProfile: profile },
    requestId,
    signal,
  );
  const lines = code.split("\n").length;
  if (
    !object(v) ||
    !text(v.id, 200) ||
    !text(v.title, 200) ||
    !text(v.language, 80) ||
    !text(v.overview) ||
    v.questionCount !== 5 ||
    !Array.isArray(v.sections) ||
    v.sections.length > 30 ||
    !v.sections.every(
      (s) =>
        object(s) &&
        text(s.title, 200) &&
        text(s.explanation) &&
        range(s, lines),
    ) ||
    !question(v.firstQuestion, lines, 1)
  )
    throw new Error(
      "Получен неполный разбор кода. Попробуй подготовить тренировку ещё раз.",
    );
  return v as Training;
}
export async function submitAnswer(
  trainingId: string,
  current: TrainingQuestion,
  answer: string,
  code: string,
  requestId: string,
  signal: AbortSignal,
): Promise<AnswerResult> {
  const v = await post(
    `/api/trainings/${encodeURIComponent(trainingId)}/answer`,
    { questionId: current.id, answer },
    requestId,
    signal,
  );
  if (
    !object(v) ||
    !object(v.feedback) ||
    !Number.isInteger(v.feedback.score) ||
    (v.feedback.score as number) < 0 ||
    (v.feedback.score as number) > 10 ||
    !text(v.feedback.summary) ||
    !text(v.feedback.explanation) ||
    v.complete !== (current.number === 5) ||
    (v.complete
      ? v.nextQuestion !== null
      : !question(v.nextQuestion, code.split("\n").length, current.number + 1))
  )
    throw new Error(
      "Сервер вернул неполный результат проверки. Повтори отправку ответа.",
    );
  return v as AnswerResult;
}
