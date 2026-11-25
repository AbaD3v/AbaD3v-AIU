export type StudentCsvRow = {
  name: string;
  completed: number;
  percent: number;
  access: string;
};

function csvText(value: string) {
  // A student's name must remain text when Excel opens the file.
  const text = /^[\s\uFEFF]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)
    ? "'" + value : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeStudentCsv(rows: StudentCsvRow[]) {
  const header = ["Имя", "Решено заданий", "Процент прохождения", "Статус доступа"];
  const lines = [header.map(csvText).join(";"), ...rows.map((row) => [
    csvText(row.name), row.completed, `${row.percent}%`, csvText(row.access),
  ].join(";"))];
  // BOM preserves Cyrillic; the delimiter hint also works across Excel locales.
  return "\uFEFFsep=;\r\n" + lines.join("\r\n") + "\r\n";
}
