import assert from "node:assert/strict";
import { test } from "node:test";
import { serializeStudentCsv } from "../app/admin/student-csv";

const header = '"Имя";"Решено заданий";"Процент прохождения";"Статус доступа"\r\n';

test("student CSV starts with UTF-8 BOM and keeps Cyrillic names and column labels", () => {
  const csv = serializeStudentCsv([
    { name: "Әлия Иванова", completed: 3, percent: 20, access: "Открыт" },
  ]);
  const bytes = Buffer.from(csv, "utf8");

  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(bytes.subarray(3).toString("utf8"),
    "sep=;\r\n" + header + '"Әлия Иванова";3;20%;"Открыт"\r\n');
});

test("student CSV keeps semicolons, quotes and embedded newlines inside text cells", () => {
  const csv = serializeStudentCsv([
    { name: 'Иван; "Иваныч"\r\nВторая строка', completed: 5, percent: 33, access: 'Вход; "приостановлен"' },
  ]);

  assert.equal(csv, "\uFEFFsep=;\r\n" + header
    + '"Иван; ""Иваныч""\r\nВторая строка";5;33%;"Вход; ""приостановлен"""\r\n');
});

test("student CSV exports zero, partial and full completion as numeric counts and percentages", () => {
  const csv = serializeStudentCsv([
    { name: "Новый студент", completed: 0, percent: 0, access: "Открыт" },
    { name: "В процессе", completed: 7, percent: 47, access: "Открыт" },
    { name: "Завершил", completed: 15, percent: 100, access: "Приостановлен" },
  ]);

  assert.deepEqual(csv.split("\r\n").slice(2), [
    '"Новый студент";0;0%;"Открыт"',
    '"В процессе";7;47%;"Открыт"',
    '"Завершил";15;100%;"Приостановлен"',
    "",
  ]);
});

test("student CSV makes formula-like names and custom access labels literal text", () => {
  for (const name of ["=1+1", "+SUM(1;1)", "-1+1", "@SUM(1;1)", "  =1+1", "\uFEFF=1+1", "\tИван", "\rИван", "\nИван"]) {
    const csv = serializeStudentCsv([
      { name, completed: 0, percent: 0, access: "=1+1" },
    ]);

    assert.equal(csv, "\uFEFFsep=;\r\n" + header
      + `"'${name}";0;0%;"'=1+1"\r\n`, `unsafe spreadsheet text: ${JSON.stringify(name)}`);
  }
});
