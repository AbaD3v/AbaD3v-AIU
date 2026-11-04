import {
  examples,
  isLanguage,
  oddExample,
  sampleKind,
  type Language,
  type Level,
} from "./languages";

export type LineRange = { start: number; end: number };
export type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  kind?: "answer";
  range?: LineRange;
  sourceCode?: string;
  proposal?: { before: string; after: string };
};
export type Question = {
  id: string;
  kind: "choice" | "text" | "code";
  text: string;
  code: string;
  language: Language;
  range: LineRange;
  choices: string[];
  expected: string;
  explanation: string;
  hint: string;
  answer: string;
  hintUsed: boolean;
  feedback: string | null;
};
export type Lesson = {
  id: string;
  title: string;
  language: Language;
  code: string;
  messages: Message[];
  question: Question | null;
  answered: number;
  draft: string;
  lastEdit: { before: string; after: string } | null;
};
export type Workspace = { version: 2; activeId: string; lessons: Lesson[] };
export type ChatIntent = "explain" | "question" | "change" | "hint";
export const workspaceKey = (accountId: string) =>
  `codeproof.workspace.v2.${accountId}`;
export const message = (
  role: Message["role"],
  text: string,
  extra: Partial<Message> = {},
): Message => ({ id: crypto.randomUUID(), role, text, ...extra });

export function createLesson(language: Language, withExample = false): Lesson {
  return {
    id: crypto.randomUUID(),
    language,
    title: withExample ? "Сумма чётных чисел" : "Новое занятие",
    code: withExample ? examples[language] : "",
    question: null,
    answered: 0,
    draft: "",
    lastEdit: null,
    messages: [
      message(
        "assistant",
        withExample
          ? "Давай разберёмся вместе. Слева — учебный пример с числами. Можешь изменить код, выделить непонятные строки или задать вопрос.\n\nС чего начнём — объяснить условие или проверить твоё понимание?"
          : "С чего начнём? Вставь свой код слева или открой учебный пример. Здесь можно обсуждать код и задавать уточняющие вопросы.",
      ),
    ],
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function text(value: unknown, max = 30000): value is string {
  return typeof value === "string" && value.length <= max;
}
function range(value: unknown): value is LineRange {
  return (
    object(value) &&
    Number.isInteger(value.start) &&
    Number.isInteger(value.end) &&
    (value.start as number) >= 1 &&
    (value.end as number) >= (value.start as number)
  );
}
function edit(value: unknown) {
  return object(value) && text(value.before) && text(value.after);
}
function validMessage(value: unknown) {
  return (
    object(value) &&
    text(value.id, 100) &&
    ["assistant", "user"].includes(value.role as string) &&
    text(value.text) &&
    (value.kind === undefined || value.kind === "answer") &&
    (value.range === undefined || range(value.range)) &&
    (value.sourceCode === undefined || text(value.sourceCode)) &&
    (value.proposal === undefined || edit(value.proposal))
  );
}
function validQuestion(value: unknown) {
  return (
    value === null ||
    (object(value) &&
      text(value.id, 100) &&
      ["choice", "text", "code"].includes(value.kind as string) &&
      text(value.text) &&
      text(value.code) &&
      isLanguage(value.language) &&
      range(value.range) &&
      Array.isArray(value.choices) &&
      value.choices.every((choice) => text(choice, 500)) &&
      text(value.expected) &&
      text(value.explanation) &&
      text(value.hint) &&
      text(value.answer) &&
      typeof value.hintUsed === "boolean" &&
      (value.feedback === null || text(value.feedback)))
  );
}

export function parseWorkspace(raw: string | null): Workspace | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (
      !object(value) ||
      value.version !== 2 ||
      !text(value.activeId, 100) ||
      !Array.isArray(value.lessons) ||
      value.lessons.length < 1 ||
      value.lessons.length > 20
    )
      return null;
    const valid = value.lessons.every(
      (lesson) =>
        object(lesson) &&
        text(lesson.id, 100) &&
        text(lesson.title, 150) &&
        isLanguage(lesson.language) &&
        text(lesson.code, 20000) &&
        Array.isArray(lesson.messages) &&
        lesson.messages.length <= 220 &&
        lesson.messages.every(validMessage) &&
        validQuestion(lesson.question) &&
        Number.isInteger(lesson.answered) &&
        (lesson.answered as number) >= 0 &&
        text(lesson.draft, 2000) &&
        (lesson.lastEdit === null || edit(lesson.lastEdit)),
    );
    if (
      !valid ||
      new Set(value.lessons.map((lesson) => lesson.id)).size !==
        value.lessons.length ||
      !value.lessons.some((lesson) => lesson.id === value.activeId)
    )
      return null;
    return value as Workspace;
  } catch {
    return null;
  }
}

export function loadWorkspace(accountId: string, language: Language) {
  let notice = "";
  try {
    const raw = localStorage.getItem(workspaceKey(accountId));
    const saved = parseWorkspace(raw);
    if (saved) return { workspace: saved, notice };
    if (raw)
      notice =
        "Сохранённое занятие не удалось прочитать. Открыт новый учебный пример.";
  } catch {
    notice = "Браузер запретил доступ к сохранённым занятиям.";
  }
  const lesson = createLesson(language, true);
  return {
    workspace: { version: 2 as const, activeId: lesson.id, lessons: [lesson] },
    notice,
  };
}

export function conditionRange(code: string): LineRange {
  const index = code.split("\n").findIndex((line) => line.includes("% 2"));
  return { start: Math.max(1, index + 1), end: Math.max(1, index + 2) };
}

export function makeQuestion(lesson: Lesson): Question {
  const kind = sampleKind(lesson.code, lesson.language);
  const format = ["choice", "text", "code"] as const;
  const questionKind = kind ? format[lesson.answered % format.length] : "text";
  const expected = kind === "odd" ? "4" : "6";
  const explanation =
    kind === "odd"
      ? "Условие выбирает нечётные числа 1 и 3. Переменная total накапливает их сумму, поэтому результат равен 4."
      : "Условие выбирает чётные числа 2 и 4. Переменная total накапливает их сумму, поэтому результат равен 6.";
  const textByKind = {
    choice: "Какое число выведет этот код?",
    text: kind
      ? "Зачем переменная total объявлена до цикла? Объясни своими словами."
      : "Что должен делать твой код? Опиши входные данные, основные действия и ожидаемый результат.",
    code:
      kind === "even"
        ? "Измени условие слева так, чтобы программа складывала нечётные числа."
        : "Измени условие слева так, чтобы программа складывала чётные числа.",
  };
  return {
    id: crypto.randomUUID(),
    kind: questionKind,
    text: textByKind[questionKind],
    code: lesson.code,
    language: lesson.language,
    range: kind
      ? conditionRange(lesson.code)
      : { start: 1, end: Math.max(1, lesson.code.split("\n").length) },
    choices: questionKind === "choice" ? ["4", "6", "10", "0"] : [],
    expected:
      questionKind === "code"
        ? kind === "even"
          ? oddExample(lesson.language)
          : examples[lesson.language]
        : expected,
    explanation:
      questionKind === "text"
        ? kind
          ? "total хранит накопленную сумму между повторениями. Если обнулять его внутри цикла, предыдущая сумма будет потеряна."
          : "Для самопроверки свяжи описание с конкретными строками. Проверь начальные значения, условия, повторения и крайние случаи. Оценка свободного ответа появится после подключения ИИ."
        : explanation,
    hint:
      questionKind === "code"
        ? "Измени проверку равенства нулю на неравенство или наоборот. Оператор % возвращает остаток от деления."
        : kind
          ? "Проследи за total от начального значения. Какие числа проходят через условие?"
          : "Начни с входных данных и ожидаемого результата. Затем назови строки, которые связывают их между собой.",
    answer: "",
    hintUsed: false,
    feedback: null,
  };
}

export function checkQuestion(question: Question, code: string) {
  if (question.kind === "text")
    return `Ответ сохранён. Сравни свою мысль с ориентиром.\n\n${question.explanation}`;
  if (question.kind === "code") {
    const [actual, expected] = [code, question.expected].map((value) =>
      value
        .trim()
        .split("\n")
        .map((line) => line.trim())
        .join("\n"),
    );
    const matches = actual === expected;
    return matches
      ? "Получилось! Условие изменено верно. Проследи, какие числа теперь добавляются к total."
      : "Изменение пока не совпадает с заданием. Сравни условие с подсказкой. В этом упражнении проверяется замена условия в учебном примере.";
  }
  return `${question.answer === question.expected ? "Верно!" : `Правильный ответ — ${question.expected}.`} ${question.explanation}`;
}

export function inferIntent(input: string): ChatIntent | null {
  if (/подсказ|намек|намёк/i.test(input)) return "hint";
  if (/вопрос|тест|проверь|проверим/i.test(input)) return "question";
  if (/измени|изменить|поменя|неч[её]т|попробуем/i.test(input)) return "change";
  if (
    /объяс|почему|зачем|как|что|разбер|разбор|цикл|услов|total|%/i.test(input)
  )
    return "explain";
  return null;
}

export function reply(
  lesson: Lesson,
  intent: ChatIntent | null,
  level: Level,
  selected: LineRange | null,
): Message {
  const kind = sampleKind(lesson.code, lesson.language);
  if (intent === "hint" && lesson.question)
    return message("assistant", lesson.question.hint, {
      range: lesson.question.range,
      sourceCode: lesson.question.code,
    });
  if (!lesson.code.trim())
    return message(
      "assistant",
      "Вставь код в редактор или нажми «Учебный пример». После этого мы сможем обсудить его и открыть вопрос.",
    );
  if (!kind)
    return message(
      "assistant",
      "Твой код сохранён в редакторе. В демо подробный разбор и предложения изменений подготовлены для учебных примеров.\n\nМожно открыть вопрос для самостоятельного объяснения своего кода или загрузить учебный пример через кнопку над редактором.",
      selected ? { range: selected, sourceCode: lesson.code } : {},
    );
  const details = {
    range: selected ?? conditionRange(lesson.code),
    sourceCode: lesson.code,
  };
  if (intent === "change")
    return message(
      "assistant",
      kind === "even"
        ? "Давай проверим другую идею. Если заменить проверку равенства на неравенство, в сумму попадут нечётные числа. Посмотри предложение и примени его, когда будешь готов."
        : "Вернём проверку чётности. В сумму снова попадут 2 и 4. Можно применить изменение и сравнить результат.",
      {
        ...details,
        proposal: {
          before: lesson.code,
          after:
            kind === "even"
              ? oddExample(lesson.language)
              : examples[lesson.language],
        },
      },
    );
  if (intent === "explain") {
    const parity = kind === "even" ? "чётные" : "нечётные";
    const selectedCode = selected
      ? lesson.code
          .split("\n")
          .slice(selected.start - 1, selected.end)
          .join("\n")
      : "";
    let explanation = `Программа перебирает числа 1, 2, 3 и 4, выбирает ${parity} и складывает их в total. Результат — ${kind === "even" ? "6" : "4"}.`;
    if (!selected || /%|if/.test(selectedCode))
      explanation += `\n\nОператор % вычисляет остаток от деления. ${kind === "even" ? "У чётного числа остаток от деления на 2 равен нулю." : "У нечётного числа остаток от деления на 2 отличен от нуля."}`;
    else if (/total.*=\s*0/.test(selectedCode))
      explanation +=
        "\n\nПеред циклом total равен нулю. Затем он хранит накопленную сумму между повторениями.";
    else if (/print|log|echo|cout|WriteLine/.test(selectedCode))
      explanation +=
        "\n\nЭта строка выводит уже вычисленное значение total после завершения цикла.";
    else
      explanation +=
        "\n\nКаждое повторение работает с очередным числом. total увеличивается только после успешной проверки условия.";
    if (level === "beginner")
      explanation +=
        "\n\nОдно повторение цикла называется итерацией. Можно мысленно подставлять каждое число и следить за суммой.";
    if (level === "confident")
      explanation +=
        "\n\nСложность прохода — O(n), дополнительная память для накопления суммы — O(1). Как повлияет пустой набор чисел?";
    return message("assistant", explanation, details);
  }
  return message(
    "assistant",
    "Можем разобрать условие, посмотреть изменение кода или потренироваться отвечать. В этом демо доступны подготовленные реплики — выбери действие ниже или напиши, например, «Объясни цикл».",
  );
}
