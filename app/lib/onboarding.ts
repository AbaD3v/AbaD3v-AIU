export const languageOptions = ["Python", "JavaScript", "Java"] as const;
export type Language = (typeof languageOptions)[number];
export type DiagnosticQuestion = {
  id: string;
  language: Language;
  topic: string;
  kind: "code" | "terminology";
  text: string;
  code?: string;
  choices: string[];
};

export const diagnosticQuestions: DiagnosticQuestion[] =
  languageOptions.flatMap((language) => {
    const prefix = language.toLowerCase();
    return [
      {
        id: `${prefix}-value`,
        language,
        topic: "variables",
        kind: "code" as const,
        text: "Что появится на экране?",
        code:
          language === "Python"
            ? "value = 4\nvalue = value + 2\nprint(value)"
            : language === "JavaScript"
              ? "let value = 4;\nvalue = value + 2;\nconsole.log(value);"
              : "int value = 4;\nvalue = value + 2;\nSystem.out.println(value);",
        choices: ["4", "6", "42", "Будет ошибка"],
      },
      {
        id: `${prefix}-loop`,
        language,
        topic: "loops",
        kind: "code" as const,
        text: "Сколько раз программа выведет число?",
        code:
          language === "Python"
            ? "for i in range(3):\n    print(i)"
            : language === "JavaScript"
              ? "for (let i = 0; i < 3; i++) {\n    console.log(i);\n}"
              : "for (int i = 0; i < 3; i++) {\n    System.out.println(i);\n}",
        choices: ["2 раза", "3 раза", "4 раза", "Бесконечно"],
      },
      {
        id: `${prefix}-term`,
        language,
        topic: "loops",
        kind: "terminology" as const,
        text: "Как ты понимаешь слово «итерация»?",
        choices: [
          "Объявление переменной",
          "Одно повторение тела цикла",
          "Завершение программы",
          "Исправление ошибки",
        ],
      },
    ];
  });
export type DiagnosticAnswer = {
  questionId: string;
  choice: number | "unknown";
};
export type LearnerProfile = {
  version: 1;
  languages: Language[];
  answers: DiagnosticAnswer[];
  completedAt: string;
};
export const profileStorageKey = "codeproof.onboarding.v1";
export function parseProfile(raw: string | null): LearnerProfile | null {
  try {
    const p = JSON.parse(raw || "null");
    if (
      !p ||
      p.version !== 1 ||
      !Array.isArray(p.languages) ||
      !p.languages.every((l: unknown) =>
        languageOptions.includes(l as Language),
      ) ||
      new Set(p.languages).size !== p.languages.length ||
      !Array.isArray(p.answers) ||
      typeof p.completedAt !== "string" ||
      !Number.isFinite(Date.parse(p.completedAt))
    )
      return null;
    const expected = diagnosticQuestions.filter((q) =>
      p.languages.includes(q.language),
    );
    if (
      p.answers.length !== expected.length ||
      new Set(p.answers.map((a: DiagnosticAnswer) => a?.questionId)).size !==
        expected.length
    )
      return null;
    for (const q of expected) {
      const a = p.answers.find((a: DiagnosticAnswer) => a?.questionId === q.id);
      if (
        !a ||
        !(
          a.choice === "unknown" ||
          (Number.isInteger(a.choice) &&
            a.choice >= 0 &&
            a.choice < q.choices.length)
        )
      )
        return null;
    }
    return {
      version: 1,
      languages: p.languages,
      answers: p.answers.map((a: DiagnosticAnswer) => ({
        questionId: a.questionId,
        choice: a.choice,
      })),
      completedAt: p.completedAt,
    };
  } catch {
    return null;
  }
}
