export type Task = {
  id: string;
  title: string;
  module: number;
  difficulty: "Начальный" | "Средний" | "Продвинутый";
  minutes: number;
  description: string;
  requirement: string;
  columns: string[];
  tables: string[];
  tags: string[];
  starter: string;
  hints: string[];
  theory: string;
  example: string;
  solution: string;
  explanation: string;
  ordered?: boolean;
};

export const modules = [
  {
    id: 1,
    title: "Знакомство с данными",
    subtitle: "SELECT · FROM · WHERE",
    description: "Выбирайте нужные столбцы и находите строки по условию.",
  },
  {
    id: 2,
    title: "Порядок и первые итоги",
    subtitle: "ORDER BY · DISTINCT · GROUP BY",
    description: "Сортируйте, убирайте повторы и считайте показатели.",
  },
  {
    id: 3,
    title: "Связи между таблицами",
    subtitle: "JOIN · LEFT JOIN · SUM",
    description: "Собирайте полную картину из нескольких таблиц.",
  },
  {
    id: 4,
    title: "От данных к отчётам",
    subtitle: "GROUP BY · HAVING · Даты",
    description: "Исследуйте продажи, покупателей и динамику выручки.",
  },
  {
    id: 5,
    title: "Работа аналитика",
    subtitle: "Подзапросы · CTE · Проверка данных",
    description: "Находите расхождения и отвечайте на бизнес-вопросы.",
  },
];

export const tasks: Task[] = [
  {
    id: "first-query",
    title: "Первый взгляд на каталог",
    module: 1,
    difficulty: "Начальный",
    minutes: 5,
    description:
      "Команда магазина собирает новый каталог. Начнём с простого: получим названия и цены всех товаров.",
    requirement:
      "Выведите name и price из таблицы products. Включите все товары, даже снятые с продажи. Порядок строк не важен.",
    columns: ["name", "price"],
    tables: ["products"],
    tags: ["SELECT", "FROM"],
    starter: "-- Выберите названия и цены товаров\nSELECT\n  \nFROM products;",
    hints: [
      "SELECT перечисляет столбцы, которые попадут в результат.",
      "После SELECT укажите name и price через запятую.",
      "Структура запроса: SELECT столбец_1, столбец_2 FROM таблица;",
    ],
    theory:
      "SELECT выбирает столбцы, FROM указывает таблицу. Звёздочка * вернёт все столбцы, но здесь нужны только два. Запрос не изменяет исходные данные.",
    example: "SELECT name, city\nFROM customers;",
    solution: "SELECT name, price FROM products;",
    explanation:
      "Мы указали два столбца в нужном порядке. Без WHERE база возвращает все строки каталога.",
  },
  {
    id: "premium-products",
    title: "Товары дороже 100",
    module: 1,
    difficulty: "Начальный",
    minutes: 7,
    description:
      "Для витрины дорогих товаров нужны только действующие позиции каталога.",
    requirement:
      "Выведите name и price для товаров с price строго больше 100 и is_active = 1. Порядок строк не важен.",
    columns: ["name", "price"],
    tables: ["products"],
    tags: ["WHERE", "AND"],
    starter: "SELECT name, price\nFROM products\nWHERE ",
    hints: [
      "Отбор строк выполняет WHERE.",
      "Соедините два условия через AND.",
      "Нужно одновременно price > 100 и is_active = 1. Значение ровно 100 не подходит.",
    ],
    theory:
      "WHERE оставляет строки, соответствующие условию. AND требует выполнения обоих условий. > не включает границу, >= включает.",
    example: "SELECT name\nFROM products\nWHERE stock > 5 AND is_active = 1;",
    solution:
      "SELECT name, price FROM products WHERE price > 100 AND is_active = 1;",
    explanation:
      "AND исключает дорогие товары, которые больше не продаются. Строгое сравнение > исключает цену ровно 100.",
  },
  {
    id: "out-of-stock",
    title: "Что закончилось на складе",
    module: 1,
    difficulty: "Начальный",
    minutes: 6,
    description:
      "Менеджеру закупок нужен список действующих товаров с нулевым остатком.",
    requirement:
      "Получите id, name и category товаров, у которых stock = 0 и is_active = 1. Порядок строк не важен.",
    columns: ["id", "name", "category"],
    tables: ["products"],
    tags: ["WHERE", "AND"],
    starter: "SELECT id, name, category\nFROM products\nWHERE ",
    hints: [
      "Проверьте столбец stock на равенство нулю.",
      "Снятые с продажи товары закупать не нужно.",
      "Добавьте AND is_active = 1.",
    ],
    theory:
      "Равенство в SQL записывается одним знаком =. Несколько условий помогают выразить точный бизнес-смысл запроса.",
    example: "SELECT name\nFROM products\nWHERE stock = 5;",
    solution:
      "SELECT id, name, category FROM products WHERE stock = 0 AND is_active = 1;",
    explanation:
      "Нулевой остаток сам по себе недостаточен: действующий товар нужно заказать, снятый с продажи — нет.",
  },
  {
    id: "top-prices",
    title: "Три самых дорогих товара",
    module: 2,
    difficulty: "Начальный",
    minutes: 8,
    description:
      "Соберём короткую подборку премиальных товаров для главной страницы магазина.",
    requirement:
      "Выведите name и price трёх самых дорогих активных товаров. Сортируйте по price по убыванию; при равной цене — по id по возрастанию.",
    columns: ["name", "price"],
    tables: ["products"],
    tags: ["ORDER BY", "LIMIT"],
    ordered: true,
    starter:
      "SELECT name, price\nFROM products\nWHERE is_active = 1\nORDER BY ",
    hints: [
      "DESC означает сортировку по убыванию.",
      "Укажите второй ключ сортировки id ASC для одинаковых цен.",
      "После ORDER BY price DESC, id ASC добавьте LIMIT 3.",
    ],
    theory:
      "ORDER BY задаёт порядок результата. ASC — по возрастанию, DESC — по убыванию. LIMIT ограничивает количество строк. Второй ключ делает порядок при равных значениях однозначным.",
    example:
      "SELECT id, name\nFROM customers\nORDER BY name ASC, id ASC\nLIMIT 5;",
    solution:
      "SELECT name, price FROM products WHERE is_active = 1 ORDER BY price DESC, id ASC LIMIT 3;",
    explanation:
      "Сначала отфильтровали активные товары, затем отсортировали и выбрали первые три. Порядок строк в этой задаче проверяется.",
  },
  {
    id: "customer-cities",
    title: "География покупателей",
    module: 2,
    difficulty: "Начальный",
    minutes: 5,
    description:
      "Для настройки доставки нужен список городов, в которых зарегистрированы покупатели.",
    requirement:
      "Выведите один столбец city без повторов, по возрастанию в стандартном порядке SQLite.",
    columns: ["city"],
    tables: ["customers"],
    tags: ["DISTINCT", "ORDER BY"],
    ordered: true,
    starter: "SELECT\nFROM customers;",
    hints: [
      "В одном городе могут жить несколько покупателей.",
      "DISTINCT удаляет одинаковые строки результата.",
      "Используйте SELECT DISTINCT city и ORDER BY city ASC.",
    ],
    theory:
      "DISTINCT убирает повторяющиеся строки. Он применяется ко всему набору выбранных столбцов: DISTINCT city, name уже не даст список уникальных городов.",
    example: "SELECT DISTINCT category\nFROM products\nORDER BY category;",
    solution: "SELECT DISTINCT city FROM customers ORDER BY city ASC;",
    explanation:
      "В результате каждый город встречается один раз. Добавление name изменило бы смысл DISTINCT.",
  },
  {
    id: "category-overview",
    title: "Средняя цена по категориям",
    module: 2,
    difficulty: "Средний",
    minutes: 10,
    description:
      "Категорийному менеджеру нужна сводка: сколько активных товаров в каждой категории и какова их средняя цена.",
    requirement:
      "Для активных товаров выведите category, количество товаров как product_count и среднюю price, округлённую до 2 знаков, как avg_price. Порядок строк не важен.",
    columns: ["category", "product_count", "avg_price"],
    tables: ["products"],
    tags: ["GROUP BY", "COUNT", "AVG"],
    starter:
      "SELECT category,\n  \nFROM products\nWHERE is_active = 1\nGROUP BY category;",
    hints: [
      "GROUP BY category объединяет товары по категориям.",
      "COUNT(*) считает товары, AVG(price) — среднюю цену.",
      "Используйте ROUND(AVG(price), 2) AS avg_price.",
    ],
    theory:
      "Агрегатные функции считают итог по группе строк. COUNT(*) — количество, AVG — среднее, SUM — сумма. AS задаёт понятное имя столбца.",
    example:
      "SELECT city, COUNT(*) AS customer_count\nFROM customers\nGROUP BY city;",
    solution:
      "SELECT category, COUNT(*) AS product_count, ROUND(AVG(price), 2) AS avg_price FROM products WHERE is_active = 1 GROUP BY category;",
    explanation:
      "WHERE исключает неактивные товары до группировки. Средняя вычисляется отдельно для каждой категории.",
  },
  {
    id: "orders-and-customers",
    title: "Кто сделал заказ",
    module: 3,
    difficulty: "Средний",
    minutes: 10,
    description:
      "В таблице orders хранится только идентификатор покупателя. Добавим имя, чтобы получить понятный список заказов.",
    requirement:
      "Для завершённых заказов (completed) выведите orders.id как order_id, имя покупателя как customer_name и ordered_at. Порядок строк не важен.",
    columns: ["order_id", "customer_name", "ordered_at"],
    tables: ["orders", "customers"],
    tags: ["JOIN", "ON"],
    starter:
      "SELECT o.id AS order_id,\n  \nFROM orders AS o\nJOIN customers AS c ON\nWHERE o.status = 'completed';",
    hints: [
      "orders.customer_id ссылается на customers.id.",
      "Условие соединения: o.customer_id = c.id.",
      "В SELECT добавьте c.name AS customer_name и o.ordered_at.",
    ],
    theory:
      "JOIN соединяет связанные строки двух таблиц. Условие ON определяет соответствие. Псевдонимы o и c сокращают запись и устраняют неоднозначность столбца id.",
    example:
      "SELECT oi.order_id, p.name\nFROM order_items AS oi\nJOIN products AS p ON oi.product_id = p.id;",
    solution:
      "SELECT o.id AS order_id, c.name AS customer_name, o.ordered_at FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.status = 'completed';",
    explanation:
      "Соединение по ключу добавляет имя покупателя к каждому заказу. Фильтр оставляет только завершённые заказы.",
  },
  {
    id: "order-totals",
    title: "Сколько стоит каждый заказ",
    module: 3,
    difficulty: "Средний",
    minutes: 12,
    description:
      "Сумма заказа складывается из его позиций. Рассчитаем её по ценам, действовавшим во время покупки.",
    requirement:
      "Для всех заказов, включая ожидающие и отменённые, выведите order_id и сумму quantity * unit_price, округлённую до 2 знаков, как total. Порядок строк не важен.",
    columns: ["order_id", "total"],
    tables: ["order_items"],
    tags: ["SUM", "GROUP BY"],
    starter: "SELECT order_id,\n  \nFROM order_items\nGROUP BY order_id;",
    hints: [
      "Стоимость позиции равна quantity * unit_price.",
      "Сложите стоимости позиций внутри каждого order_id.",
      "Используйте ROUND(SUM(quantity * unit_price), 2) AS total.",
    ],
    theory:
      "Внутри SUM можно использовать выражение. Цены в order_items сохраняют историю покупки: текущая цена из products могла измениться.",
    example:
      "SELECT product_id, SUM(quantity) AS units\nFROM order_items\nGROUP BY product_id;",
    solution:
      "SELECT order_id, ROUND(SUM(quantity * unit_price), 2) AS total FROM order_items GROUP BY order_id;",
    explanation:
      "Группировка даёт одну строку на заказ. Умножение учитывает количество единиц каждого товара.",
  },
  {
    id: "customers-without-orders",
    title: "Покупатели без заказов",
    module: 3,
    difficulty: "Средний",
    minutes: 12,
    description:
      "Отдел маркетинга хочет связаться с теми, кто зарегистрировался, но ещё не сделал ни одного заказа.",
    requirement:
      "Выведите id и name покупателей без каких-либо заказов. Даже отменённый или ожидающий заказ означает, что покупатель не подходит. Порядок строк не важен.",
    columns: ["id", "name"],
    tables: ["customers", "orders"],
    tags: ["LEFT JOIN", "IS NULL"],
    starter:
      "SELECT c.id, c.name\nFROM customers AS c\nLEFT JOIN orders AS o ON c.id = o.customer_id\nWHERE ",
    hints: [
      "LEFT JOIN сохраняет покупателей даже без соответствующей строки заказа.",
      "У покупателя без заказа значения столбцов orders будут NULL.",
      "Отберите WHERE o.id IS NULL. Также подойдёт NOT EXISTS.",
    ],
    theory:
      "LEFT JOIN оставляет все строки левой таблицы. Когда соответствия справа нет, её столбцы содержат NULL. Проверять NULL нужно через IS NULL, а не = NULL.",
    example:
      "SELECT o.id\nFROM orders AS o\nLEFT JOIN payments AS p ON p.order_id = o.id\nWHERE p.id IS NULL;",
    solution:
      "SELECT c.id, c.name FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE o.id IS NULL;",
    explanation:
      "Мы ищем отсутствие любого заказа. Фильтр по статусу изменил бы задачу и ошибочно включил часть покупателей.",
  },
  {
    id: "product-revenue",
    title: "Выручка по товарам",
    module: 4,
    difficulty: "Средний",
    minutes: 15,
    description:
      "Узнаем, сколько денег принёс каждый товар в завершённых заказах.",
    requirement:
      "Выведите products.id как product_id, name и ROUND(SUM(quantity * unit_price), 2) как revenue только по completed-заказам. Включайте лишь товары с такими продажами. Порядок строк не важен.",
    columns: ["product_id", "name", "revenue"],
    tables: ["products", "orders", "order_items"],
    tags: ["JOIN", "SUM", "GROUP BY"],
    starter:
      "SELECT p.id AS product_id, p.name,\n  \nFROM products AS p\nJOIN order_items AS oi ON oi.product_id = p.id\nJOIN orders AS o ON o.id = oi.order_id\n",
    hints: [
      "Отфильтруйте o.status = 'completed'.",
      "Сумма продаж — SUM(oi.quantity * oi.unit_price).",
      "Группируйте по p.id и p.name: одинаковые названия могут принадлежать разным товарам.",
    ],
    theory:
      "JOIN можно применять несколько раз. Агрегируйте по устойчивому ключу id: название не обязательно уникально. Историческая цена покупки важнее текущей цены каталога.",
    example:
      "SELECT o.customer_id, SUM(oi.quantity) AS units\nFROM orders o JOIN order_items oi ON oi.order_id = o.id\nWHERE o.status = 'completed'\nGROUP BY o.customer_id;",
    solution:
      "SELECT p.id AS product_id, p.name, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM products p JOIN order_items oi ON oi.product_id = p.id JOIN orders o ON o.id = oi.order_id WHERE o.status = 'completed' GROUP BY p.id, p.name;",
    explanation:
      "Выручка считается по составу завершённых заказов. Снятые с продажи товары тоже могли принести выручку раньше.",
  },
  {
    id: "repeat-customers",
    title: "Постоянные покупатели",
    module: 4,
    difficulty: "Средний",
    minutes: 12,
    description:
      "Для программы лояльности найдём покупателей, которые завершили не менее двух заказов.",
    requirement:
      "Выведите customers.id как customer_id, name и количество completed-заказов как order_count. Оставьте покупателей с двумя или более такими заказами. Порядок строк не важен.",
    columns: ["customer_id", "name", "order_count"],
    tables: ["customers", "orders"],
    tags: ["HAVING", "COUNT"],
    starter:
      "SELECT c.id AS customer_id, c.name,\n  \nFROM customers c\nJOIN orders o ON o.customer_id = c.id\n",
    hints: [
      "WHERE фильтрует статус заказа до группировки.",
      "GROUP BY c.id, c.name создаёт отдельную группу для каждого покупателя.",
      "Условие для количества в группе: HAVING COUNT(*) >= 2.",
    ],
    theory:
      "WHERE фильтрует отдельные строки, HAVING — уже собранные группы. Условия на COUNT, SUM и AVG обычно записывают в HAVING.",
    example:
      "SELECT category, COUNT(*) AS total\nFROM products\nGROUP BY category\nHAVING COUNT(*) > 2;",
    solution:
      "SELECT c.id AS customer_id, c.name, COUNT(*) AS order_count FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status = 'completed' GROUP BY c.id, c.name HAVING COUNT(*) >= 2;",
    explanation:
      "Сначала исключаем незавершённые заказы, затем считаем их у каждого покупателя и оставляем группы от двух заказов.",
  },
  {
    id: "monthly-revenue",
    title: "Продажи по месяцам",
    module: 4,
    difficulty: "Продвинутый",
    minutes: 15,
    description: "Построим основу ежемесячного отчёта по выручке магазина.",
    requirement:
      "По completed-заказам выведите месяц ordered_at в формате YYYY-MM как month и выручку по позициям как revenue, округлённую до 2 знаков. Сортируйте month по возрастанию. Месяцы без продаж не добавляйте.",
    columns: ["month", "revenue"],
    tables: ["orders", "order_items"],
    tags: ["STRFTIME", "GROUP BY"],
    ordered: true,
    starter:
      "SELECT strftime('%Y-%m', o.ordered_at) AS month,\n  \nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\n",
    hints: [
      "Выделите месяц через strftime('%Y-%m', o.ordered_at).",
      "Отберите completed-заказы и сгруппируйте по month.",
      "Сложите quantity * unit_price и добавьте ORDER BY month ASC.",
    ],
    theory:
      "В SQLite strftime форматирует даты. %Y — год, %m — номер месяца. Формат YYYY-MM удобно сортировать как текст, сохраняя хронологический порядок.",
    example:
      "SELECT strftime('%Y-%m', registered_at) AS month,\n  COUNT(*) AS registrations\nFROM customers\nGROUP BY month\nORDER BY month;",
    solution:
      "SELECT strftime('%Y-%m', o.ordered_at) AS month, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.status = 'completed' GROUP BY month ORDER BY month ASC;",
    explanation:
      "Группировка по году и месяцу не смешивает разные годы. Отмена и ожидание не входят в выручку.",
  },
  {
    id: "unpaid-orders",
    title: "Заказы без успешной оплаты",
    module: 5,
    difficulty: "Продвинутый",
    minutes: 15,
    description:
      "У некоторых заказов есть неудачные попытки оплаты. Найдём заказы, для которых так и не прошёл ни один платёж.",
    requirement:
      "Выведите id, customer_id и ordered_at всех неотменённых заказов без единого платежа со status = 'success'. Порядок строк не важен.",
    columns: ["id", "customer_id", "ordered_at"],
    tables: ["orders", "payments"],
    tags: ["NOT EXISTS", "Подзапрос"],
    starter:
      "SELECT o.id, o.customer_id, o.ordered_at\nFROM orders o\nWHERE o.status != 'cancelled'\n  AND ",
    hints: [
      "Проверять только отсутствие любых платежей недостаточно: бывают failed-попытки.",
      "NOT EXISTS позволяет проверить отсутствие успешного платежа для конкретного заказа.",
      "Свяжите подзапрос с заказом через p.order_id = o.id и отберите p.status = 'success'.",
    ],
    theory:
      "EXISTS проверяет, возвращает ли подзапрос хотя бы одну строку. NOT EXISTS — ни одной. Коррелированный подзапрос обращается к строке внешнего запроса.",
    example:
      "SELECT c.id, c.name\nFROM customers c\nWHERE EXISTS (\n  SELECT 1 FROM orders o WHERE o.customer_id = c.id\n);",
    solution:
      "SELECT o.id, o.customer_id, o.ordered_at FROM orders o WHERE o.status != 'cancelled' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.order_id = o.id AND p.status = 'success');",
    explanation:
      "Failed-платежи не подтверждают оплату. NOT EXISTS учитывает и полное отсутствие платежей, и наличие только неудачных попыток.",
  },
  {
    id: "payment-audit",
    title: "Аудит платежей",
    module: 5,
    difficulty: "Продвинутый",
    minutes: 20,
    description:
      "Финансовая команда просит найти завершённые заказы, у которых сумма успешных оплат не совпадает со стоимостью товаров.",
    requirement:
      "Выведите order_id, сумму позиций как order_total и сумму успешных платежей как paid_total, обе с округлением до 2 знаков. Для completed-заказов без успешных оплат считайте paid_total = 0. Включите только расхождения.",
    columns: ["order_id", "order_total", "paid_total"],
    tables: ["orders", "order_items", "payments"],
    tags: ["WITH", "COALESCE", "SUM"],
    starter:
      "WITH totals AS (\n  SELECT order_id, SUM(quantity * unit_price) AS total\n  FROM order_items\n  GROUP BY order_id\n)\nSELECT ",
    hints: [
      "Сначала отдельно посчитайте суммы позиций и суммы платежей по заказам. Иначе JOIN размножит строки.",
      "Соедините orders с итогами позиций и LEFT JOIN с итогами только success-платежей.",
      "COALESCE(paid_total, 0) заменит NULL. Сравнивайте суммы после ROUND(..., 2).",
    ],
    theory:
      "WITH даёт имя промежуточному результату. Сначала агрегируйте независимые отношения «один ко многим», затем соединяйте итоги. COALESCE возвращает первое значение, отличное от NULL.",
    example:
      "WITH counts AS (\n  SELECT customer_id, COUNT(*) AS total\n  FROM orders GROUP BY customer_id\n)\nSELECT c.name, COALESCE(x.total, 0)\nFROM customers c LEFT JOIN counts x ON x.customer_id = c.id;",
    solution:
      "WITH totals AS (SELECT order_id, ROUND(SUM(quantity * unit_price), 2) AS total FROM order_items GROUP BY order_id), paid AS (SELECT order_id, ROUND(SUM(amount), 2) AS total FROM payments WHERE status = 'success' GROUP BY order_id) SELECT o.id AS order_id, t.total AS order_total, COALESCE(p.total, 0) AS paid_total FROM orders o JOIN totals t ON t.order_id = o.id LEFT JOIN paid p ON p.order_id = o.id WHERE o.status = 'completed' AND t.total != COALESCE(p.total, 0);",
    explanation:
      "Две независимые агрегации предотвращают двойной подсчёт. Заказ с двумя корректными частичными платежами не должен попасть в расхождения.",
  },
  {
    id: "top-customers",
    title: "Три главных покупателя",
    module: 5,
    difficulty: "Продвинутый",
    minutes: 18,
    description:
      "Финальная задача: подготовьте рейтинг покупателей по стоимости их завершённых заказов.",
    requirement:
      "Выведите customer_id, name и total_spent — сумму quantity * unit_price по completed-заказам, округлённую до 2 знаков. Оставьте топ-3 по убыванию суммы. При равных суммах сортируйте customer_id по возрастанию.",
    columns: ["customer_id", "name", "total_spent"],
    tables: ["customers", "orders", "order_items"],
    tags: ["JOIN", "GROUP BY", "LIMIT"],
    ordered: true,
    starter: "-- Объедините покупателей, заказы и их состав\nSELECT ",
    hints: [
      "Путь связи: customers.id → orders.customer_id → order_items.order_id.",
      "Отберите completed-заказы и сгруппируйте по id и name покупателя.",
      "Отсортируйте total_spent DESC, customer_id ASC и оставьте LIMIT 3.",
    ],
    theory:
      "В одном запросе можно объединить фильтрацию, связи, группировку, сортировку и ограничение. Сначала определите строки-источники, затем уровень группировки и итоговые столбцы.",
    example:
      "SELECT category, ROUND(SUM(price * stock), 2) AS value\nFROM products\nWHERE is_active = 1\nGROUP BY category\nORDER BY value DESC;",
    solution:
      "SELECT c.id AS customer_id, c.name, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_spent FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items oi ON oi.order_id = o.id WHERE o.status = 'completed' GROUP BY c.id, c.name ORDER BY total_spent DESC, c.id ASC LIMIT 3;",
    explanation:
      "Запрос объединяет всё изученное: три таблицы, фильтрацию по статусу, сумму покупок и рейтинг с однозначным порядком.",
  },
];

export const getTask = (id: string) => tasks.find((task) => task.id === id);
export const taskHref = (id: string) => "/practice/" + id + "/";
