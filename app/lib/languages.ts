export const languages = [
  { name: "Python", extension: "py", mark: "Py" },
  { name: "JavaScript", extension: "js", mark: "JS" },
  { name: "TypeScript", extension: "ts", mark: "TS" },
  { name: "Java", extension: "java", mark: "Ja" },
  { name: "C", extension: "c", mark: "C" },
  { name: "C++", extension: "cpp", mark: "C++" },
  { name: "C#", extension: "cs", mark: "C#" },
  { name: "Go", extension: "go", mark: "Go" },
  { name: "Rust", extension: "rs", mark: "Rs" },
  { name: "PHP", extension: "php", mark: "Ph" },
  { name: "Kotlin", extension: "kt", mark: "Kt" },
  { name: "Swift", extension: "swift", mark: "Sw" },
] as const;

export type Language = (typeof languages)[number]["name"];
export type Level = "beginner" | "learning" | "confident";
export const levels: { value: Level; label: string; detail: string }[] = [
  {
    value: "beginner",
    label: "Начинаю",
    detail: "Объяснять термины и каждую идею",
  },
  {
    value: "learning",
    label: "Уже пишу код",
    detail: "Разбирать логику на примерах",
  },
  {
    value: "confident",
    label: "Готовлюсь к защите",
    detail: "Больше вопросов о решениях в коде",
  },
];

export function isLanguage(value: unknown): value is Language {
  return languages.some((language) => language.name === value);
}

export function isLevel(value: unknown): value is Level {
  return levels.some((level) => level.value === value);
}

export const examples: Record<Language, string> = {
  Python:
    "numbers = [1, 2, 3, 4]\ntotal = 0\n\nfor number in numbers:\n    if number % 2 == 0:\n        total += number\n\nprint(total)",
  JavaScript:
    "const numbers = [1, 2, 3, 4];\nlet total = 0;\n\nfor (const number of numbers) {\n  if (number % 2 === 0) {\n    total += number;\n  }\n}\n\nconsole.log(total);",
  TypeScript:
    "const numbers: number[] = [1, 2, 3, 4];\nlet total: number = 0;\n\nfor (const number of numbers) {\n  if (number % 2 === 0) {\n    total += number;\n  }\n}\n\nconsole.log(total);",
  Java: "public class Main {\n  public static void main(String[] args) {\n    int[] numbers = {1, 2, 3, 4};\n    int total = 0;\n\n    for (int number : numbers) {\n      if (number % 2 == 0) {\n        total += number;\n      }\n    }\n\n    System.out.println(total);\n  }\n}",
  C: '#include <stdio.h>\n\nint main(void) {\n  int numbers[] = {1, 2, 3, 4};\n  int total = 0;\n\n  for (int i = 0; i < 4; i++) {\n    if (numbers[i] % 2 == 0) {\n      total += numbers[i];\n    }\n  }\n\n  printf("%d\\n", total);\n  return 0;\n}',
  "C++":
    "#include <iostream>\n\nint main() {\n  int numbers[] = {1, 2, 3, 4};\n  int total = 0;\n\n  for (int number : numbers) {\n    if (number % 2 == 0) {\n      total += number;\n    }\n  }\n\n  std::cout << total << '\\n';\n}",
  "C#": "int[] numbers = {1, 2, 3, 4};\nint total = 0;\n\nforeach (int number in numbers) {\n  if (number % 2 == 0) {\n    total += number;\n  }\n}\n\nSystem.Console.WriteLine(total);",
  Go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  numbers := []int{1, 2, 3, 4}\n  total := 0\n\n  for _, number := range numbers {\n    if number % 2 == 0 {\n      total += number\n    }\n  }\n\n  fmt.Println(total)\n}',
  Rust: 'fn main() {\n    let numbers = [1, 2, 3, 4];\n    let mut total = 0;\n\n    for number in numbers {\n        if number % 2 == 0 {\n            total += number;\n        }\n    }\n\n    println!("{}", total);\n}',
  PHP: "<?php\n$numbers = [1, 2, 3, 4];\n$total = 0;\n\nforeach ($numbers as $number) {\n    if ($number % 2 == 0) {\n        $total += $number;\n    }\n}\n\necho $total;",
  Kotlin:
    "fun main() {\n    val numbers = listOf(1, 2, 3, 4)\n    var total = 0\n\n    for (number in numbers) {\n        if (number % 2 == 0) {\n            total += number\n        }\n    }\n\n    println(total)\n}",
  Swift:
    "let numbers = [1, 2, 3, 4]\nvar total = 0\n\nfor number in numbers {\n    if number % 2 == 0 {\n        total += number\n    }\n}\n\nprint(total)",
};

export function oddExample(language: Language) {
  return examples[language].replace(
    /% 2 (===|==) 0/,
    (_, operator: string) => `% 2 ${operator === "===" ? "!==" : "!="} 0`,
  );
}

export function sampleKind(code: string, language: Language) {
  if (code.trim() === examples[language]) return "even";
  if (code.trim() === oddExample(language)) return "odd";
  return null;
}
