export const checkFeedbackNames = {
  "practice.feedbackLimit": "Результат превышает 1 000 строк. Проверьте соединения таблиц и условия.",
  "practice.feedbackColumns": "Нужно столбцов: {expected}. В вашем результате: {actual}.",
  "practice.feedbackRows": "Ожидается строк: {expected}. Получено: {actual}. Проверьте фильтрацию, повторы и соединения.",
  "practice.feedbackMatch": "Результат совпадает.",
  "practice.feedbackOrder": "Значения или порядок строк отличаются. Проверьте ORDER BY и дополнительные ключи сортировки.",
  "practice.feedbackValues": "Количество строк верное, но значения отличаются. Проверьте вычисления и порядок столбцов.",
  "practice.feedbackOtherData": "Запрос не прошёл на изменённых данных. Проверьте границы условий, повторяющиеся имена, статусы и связи по id.",
} as const;

type FeedbackKey = keyof typeof checkFeedbackNames;
export type CheckFeedback = { key: FeedbackKey; counts?: { actual: number; expected: number } };

export function formatCheckFeedback(template: string, counts?: CheckFeedback["counts"]) {
  if (!counts) return template;
  return template.replaceAll("{actual}", String(counts.actual)).replaceAll("{expected}", String(counts.expected));
}
