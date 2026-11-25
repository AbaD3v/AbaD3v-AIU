import { tasks } from "../sql/course";

export const lessonInterfaceNames = {
  "practice.loadingEditor": "Загрузка редактора…",
  "practice.editorFile": "solution.sql",
  "practice.noMatches": "Запрос выполнен. Ни одна строка не соответствует условиям.",
  "practice.runError": "Не удалось выполнить запрос.",
  "practice.stopNotice": "Запрос остановлен. Можно изменить его и запустить снова. Попытка не засчитана.",
  "practice.downloadNotice": "Скачивание SQL-запроса запрошено.",
  "practice.downloadError": "Не удалось скачать запрос. Скопируйте текст из редактора.",
  "practice.copyNotice": "Запрос скопирован.",
  "practice.copyError": "Не удалось скопировать запрос. Выделите текст в редакторе и скопируйте вручную.",
  "practice.csvNotice": "Скачивание результата CSV запрошено.",
  "practice.csvError": "Не удалось скачать CSV. Попробуйте ещё раз.",
  "practice.columnOrder": "Столбцы в указанном порядке. Псевдонимы могут отличаться.",
  "practice.ordered": "Порядок строк учитывается.",
  "practice.unordered": "Порядок строк не важен.",
  "practice.hintAdvice": "Открывайте подсказки постепенно. Решение с помощью тоже засчитывается.",
  "practice.queryLimit": "Запрос ограничен 20 000 символами. Сохранены первые 20 000 — сократите запрос перед запуском.",
  "practice.preparingDatabase": "Подготавливаем учебную базу…",
  "practice.staleResult": "Запрос изменён. Запустите его снова, чтобы обновить результат.",
  "practice.checking": "Проверяем на трёх наборах данных…",
  "practice.running": "Выполняем запрос…",
  "practice.truncatedResult": "показаны первые 1 000 строк",
  "practice.rowsUnit": "строк",
  "practice.elapsedUnit": "мс",
  "practice.emptyResultTip": "Напиши SQL и нажми «{button}». Результат появится здесь в виде таблицы.",
  "practice.emptyResultExample": "SELECT возможности FROM практика;",
  "practice.checkSummary": "Запрос прошёл все три набора данных.",
  "practice.progressLocal": "Прогресс доступен в этой вкладке — экспортируйте его перед выходом.",
  "practice.progressSaved": "Прогресс сохранён.",
  "practice.checkAdvice": "Посмотрите, какая проверка не прошла, и уточните запрос.",
  "practice.independentResult": "Самостоятельное решение — без подсказок.",
  "practice.assistedResult": "Решение с помощью — можно вернуться и потренироваться ещё.",
  "practice.checkIntro": "«{button}» сравнит результат на учебной базе и двух дополнительных наборах.",
  "practice.checkCriteria": "Проверяются значения и число строк, а не текст запроса.",
  "practice.emptyHistoryTip": "После первого запуска сохраним запрос и результат его выполнения.",
  "practice.databaseReady": "База готова к работе",
  "practice.databaseConnecting": "Подключаем базу",
  "practice.readOnly": "Только чтение · исходные данные остаются целыми",
  "practice.restartWarning": "Начнём новую попытку: сбросим результат этой задачи, подсказки и черновик. История запросов, заметки и остальные задания останутся. Текущий запрос можно скачать перед сбросом.",
  "practice.restartNotice": "Задача начата заново. История предыдущих попыток сохранена.",
  "practice.replaceWarning": "Твой текущий запрос будет заменён готовым решением. Сначала его можно скачать.",
  "practice.resetWarning": "Текущий черновик будет заменён шаблоном задания. Предыдущие запуски останутся в истории.",
  "practice.solutionWarning": "После просмотра новая успешная попытка будет отмечена как решение с помощью. Уже полученная отметка о самостоятельном решении сохранится.",
  "practice.restoreWarning": "В задании «{task}» уже есть другой запрос. Можно скачать его перед заменой. История запусков сохранится.",
  "practice.draftDownloaded": "Скачивание черновика запрошено.",
  "practice.draftDownloadError": "Не удалось скачать файл. Скопируйте запрос из окна перед заменой.",
} as const;

type LessonFieldName = "description" | "requirement" | "theory" | "example" | "starter"
  | "solution" | "explanation" | `hint.${number}` | `tag.${number}`;

export function lessonFieldKey(taskId: string, field: LessonFieldName) {
  return `task.${taskId}.${field}` as const;
}

export type LessonField = {
  key: ReturnType<typeof lessonFieldKey>;
  label: string;
  original: string;
  kind: "text" | "multiline" | "sql";
};

export const lessonContentGroups = tasks.map((task) => {
  function field(id: LessonFieldName, label: string, original: string, kind: LessonField["kind"] = "multiline"): LessonField {
    return { key: lessonFieldKey(task.id, id), label, original, kind };
  }
  return {
    id: `lesson-${task.id}`,
    title: task.title,
    fields: [
      field("description", "Контекст", task.description),
      field("requirement", "Условие задания", task.requirement),
      ...task.tags.map((tag, i) => field(`tag.${i + 1}`, `Тема ${i + 1}`, tag, "text")),
      ...task.hints.map((hint, i) => field(`hint.${i + 1}`, `Подсказка ${i + 1}`, hint)),
      field("theory", "Теория", task.theory),
      field("example", "Пример SQL к теории", task.example, "sql"),
      field("starter", "Начальный запрос в редакторе", task.starter, "sql"),
      field("solution", "SQL в разборе решения", task.solution, "sql"),
      field("explanation", "Объяснение решения", task.explanation),
    ],
  };
});
