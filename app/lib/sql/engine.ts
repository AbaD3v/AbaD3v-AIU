import type { Database, SqlJsStatic } from "sql.js";
import { createShopData, schemaSql, tables, type Cell } from "./schema";
import { getTask } from "./course";

export type QueryResult = {
  columns: string[];
  rows: Cell[][];
  elapsed: number;
  truncated: boolean;
};
export type Check = { label: string; passed: boolean; message: string };
export type GradeResult = {
  passed: boolean;
  checks: Check[];
  result: QueryResult;
};
export const MAX_ROWS = 1000;
export const MAX_QUERY_LENGTH = 20000;

export function buildDatabase(SQL: SqlJsStatic, variant = 0): Database {
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON;");
  db.run(schemaSql);
  const data = createShopData(variant);
  for (const table of tables) {
    const statement = db.prepare(
      "INSERT INTO " +
        table.name +
        " VALUES (" +
        table.fields.map(() => "?").join(",") +
        ");",
    );
    try {
      for (const row of data[table.name]) statement.run(row);
    } finally {
      statement.free();
    }
  }
  db.run("PRAGMA query_only = ON;");
  return db;
}

function leadingSql(sql: string): string {
  // Only classify the leading token. SQLite itself parses the statement,
  // so semicolons inside strings/comments are handled by its real parser.
  return sql.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, "").trim();
}

export function executeQuery(db: Database, sql: string): QueryResult {
  if (!sql.trim()) throw new Error("Напишите SQL-запрос перед запуском.");
  if (sql.length > MAX_QUERY_LENGTH)
    throw new Error("Запрос слишком длинный. Максимум — 20 000 символов.");
  if (!/^(SELECT|WITH)\b/i.test(leadingSql(sql))) {
    throw new Error(
      "В практикуме доступны запросы SELECT и WITH. Учебная база защищена от изменений.",
    );
  }
  const started = performance.now();
  const iterator = db.iterateStatements(sql);
  const first = iterator.next();
  if (first.done || !first.value) throw new Error("Не найден SQL-запрос.");
  const statement = first.value;
  try {
    const columns = statement.getColumnNames();
    if (!columns.length)
      throw new Error("Запрос должен возвращать таблицу данных.");
    const rows: Cell[][] = [];
    let truncated = false;
    while (statement.step()) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      rows.push(
        statement
          .get()
          .map((value) =>
            value instanceof Uint8Array ? "[BLOB]" : value,
          ) as Cell[],
      );
    }
    const next = iterator.next();
    if (!next.done) {
      next.value.free();
      throw new Error(
        "Запускайте один запрос за раз. Удалите второй SQL-запрос.",
      );
    }
    return {
      columns,
      rows,
      truncated,
      elapsed: Math.round((performance.now() - started) * 10) / 10,
    };
  } finally {
    statement.free();
  }
}

function rowKey(row: Cell[]) {
  return JSON.stringify(
    row.map((value) =>
      typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value,
    ),
  );
}

export function compareResults(
  actual: QueryResult,
  expected: QueryResult,
  ordered = false,
): { passed: boolean; message: string } {
  if (actual.truncated)
    return {
      passed: false,
      message:
        "Результат превышает 1 000 строк. Проверьте соединения таблиц и условия.",
    };
  if (actual.columns.length !== expected.columns.length)
    return {
      passed: false,
      message:
        "Нужно столбцов: " +
        expected.columns.length +
        ". В вашем результате: " +
        actual.columns.length +
        ".",
    };
  if (actual.rows.length !== expected.rows.length)
    return {
      passed: false,
      message:
        "Ожидается строк: " +
        expected.rows.length +
        ". Получено: " +
        actual.rows.length +
        ". Проверьте фильтрацию, повторы и соединения.",
    };
  const received = actual.rows.map(rowKey);
  const target = expected.rows.map(rowKey);
  if (!ordered) {
    received.sort();
    target.sort();
  }
  const passed = received.every((value, i) => value === target[i]);
  return {
    passed,
    message: passed
      ? "Результат совпадает."
      : ordered
        ? "Значения или порядок строк отличаются. Проверьте ORDER BY и дополнительные ключи сортировки."
        : "Количество строк верное, но значения отличаются. Проверьте вычисления и порядок столбцов.",
  };
}

export function gradeQuery(
  SQL: SqlJsStatic,
  taskId: string,
  sql: string,
): GradeResult {
  const task = getTask(taskId);
  if (!task) throw new Error("Задание не найдено.");
  const checks: Check[] = [];
  let result: QueryResult | undefined;
  const labels = ["Учебная база", "Другие данные", "Граничные случаи"];
  for (let variant = 0; variant < 3; variant++) {
    const db = buildDatabase(SQL, variant);
    try {
      const actual = executeQuery(db, sql);
      const expected = executeQuery(db, task.solution);
      if (variant === 0) result = actual;
      const comparison = compareResults(actual, expected, task.ordered);
      checks.push({
        label: labels[variant],
        passed: comparison.passed,
        message:
          variant === 0 || comparison.passed
            ? comparison.message
            : "Запрос не прошёл на изменённых данных. Проверьте границы условий, повторяющиеся имена, статусы и связи по id.",
      });
    } finally {
      db.close();
    }
  }
  return {
    passed: checks.every((check) => check.passed),
    checks,
    result: result!,
  };
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("no such column:"))
    return (
      "Не найден столбец «" +
      message.split("no such column:")[1].trim() +
      "». Проверьте его имя в схеме базы."
    );
  if (message.includes("no such table:"))
    return (
      "Не найдена таблица «" +
      message.split("no such table:")[1].trim() +
      "». Доступные таблицы показаны в схеме."
    );
  if (message.includes("ambiguous column name:"))
    return (
      "Неоднозначный столбец: " +
      message.split("ambiguous column name:")[1].trim() +
      ". Укажите таблицу или её псевдоним."
    );
  if (message.includes("readonly"))
    return "Учебная база доступна только для чтения. Используйте SELECT или WITH.";
  if (message.includes("incomplete input"))
    return "Запрос не завершён. Проверьте список столбцов, условия и закрывающие скобки.";
  if (message.includes("syntax error"))
    return (
      "Ошибка синтаксиса SQL: " +
      message +
      ". Проверьте запятые, кавычки и порядок команд."
    );
  return message;
}
