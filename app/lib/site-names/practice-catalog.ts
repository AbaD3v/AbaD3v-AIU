import { modules } from "../sql/course";

export const catalogTextDefaults = {
  "catalog.intro": "Пиши запросы, исследуй данные и проверяй решения в настоящей базе.",
  "catalog.engine": "SQLite",
  "catalog.heroDescription": "Один интернет-магазин. Пять связанных таблиц.\nПятнадцать задач, которые решает аналитик.",
  "catalog.heroFootnote": "Все задания открыты. Можно идти в своём темпе.",
  "catalog.programDescription": "От простых выборок до ответов на бизнес-вопросы.",
  "catalog.emptyHelp": "Попробуйте другой запрос или сбросьте фильтры.",
  "catalog.databaseDescription": "Товары, покупатели, заказы и платежи. Все задачи связаны одной историей.",
  "catalog.referenceDescription": "Короткие объяснения и примеры SQL-команд всегда под рукой.",
  "catalog.tipBody": "Сначала посмотри на данные. Хороший запрос начинается с хорошего вопроса.",
} as const;

export const catalogModuleFields = modules.flatMap((module) => [
  { key: `module.subtitle.${module.id}` as const, original: module.subtitle },
  { key: `module.description.${module.id}` as const, original: module.description },
]);
