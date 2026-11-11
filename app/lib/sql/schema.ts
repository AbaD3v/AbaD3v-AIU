export type Cell = string | number | null;
export type Field = {
  name: string;
  type: string;
  description: string;
  key?: "pk" | "fk";
  reference?: string;
};
export type ShopTable = {
  name: string;
  label: string;
  description: string;
  fields: Field[];
};

export const tables: ShopTable[] = [
  {
    name: "products",
    label: "Товары",
    description:
      "Каталог магазина. Цены указаны в условных единицах. is_active: 1 — в продаже, 0 — снят с продажи.",
    fields: [
      {
        name: "id",
        type: "INTEGER",
        description: "Идентификатор товара",
        key: "pk",
      },
      { name: "name", type: "TEXT", description: "Название товара" },
      { name: "category", type: "TEXT", description: "Категория" },
      { name: "price", type: "REAL", description: "Текущая цена" },
      { name: "stock", type: "INTEGER", description: "Остаток на складе" },
      {
        name: "is_active",
        type: "INTEGER",
        description: "Доступен ли товар в каталоге",
      },
    ],
  },
  {
    name: "customers",
    label: "Покупатели",
    description:
      "Покупатели магазина. Некоторые ещё не сделали ни одного заказа. Имена могут совпадать: используйте id.",
    fields: [
      {
        name: "id",
        type: "INTEGER",
        description: "Идентификатор покупателя",
        key: "pk",
      },
      { name: "name", type: "TEXT", description: "Имя покупателя" },
      { name: "city", type: "TEXT", description: "Город" },
      {
        name: "registered_at",
        type: "TEXT",
        description: "Дата регистрации, YYYY-MM-DD",
      },
    ],
  },
  {
    name: "orders",
    label: "Заказы",
    description:
      "Статусы: completed — завершён, pending — ожидает обработки, cancelled — отменён. Выручку в заданиях считаем по завершённым заказам.",
    fields: [
      {
        name: "id",
        type: "INTEGER",
        description: "Идентификатор заказа",
        key: "pk",
      },
      {
        name: "customer_id",
        type: "INTEGER",
        description: "Покупатель",
        key: "fk",
        reference: "customers.id",
      },
      {
        name: "ordered_at",
        type: "TEXT",
        description: "Дата заказа, YYYY-MM-DD",
      },
      {
        name: "status",
        type: "TEXT",
        description: "completed / pending / cancelled",
      },
    ],
  },
  {
    name: "order_items",
    label: "Состав заказов",
    description:
      "Одна строка — один товар в заказе. Историческая цена unit_price может отличаться от текущей products.price.",
    fields: [
      {
        name: "id",
        type: "INTEGER",
        description: "Идентификатор позиции",
        key: "pk",
      },
      {
        name: "order_id",
        type: "INTEGER",
        description: "Заказ",
        key: "fk",
        reference: "orders.id",
      },
      {
        name: "product_id",
        type: "INTEGER",
        description: "Товар",
        key: "fk",
        reference: "products.id",
      },
      { name: "quantity", type: "INTEGER", description: "Количество единиц" },
      {
        name: "unit_price",
        type: "REAL",
        description: "Цена единицы на момент покупки",
      },
    ],
  },
  {
    name: "payments",
    label: "Платежи",
    description:
      "Статусы: success — успешный платёж, failed — неудачная попытка. У заказа может быть несколько платежей.",
    fields: [
      {
        name: "id",
        type: "INTEGER",
        description: "Идентификатор платежа",
        key: "pk",
      },
      {
        name: "order_id",
        type: "INTEGER",
        description: "Заказ",
        key: "fk",
        reference: "orders.id",
      },
      { name: "amount", type: "REAL", description: "Сумма платежа" },
      { name: "status", type: "TEXT", description: "success / failed" },
      { name: "paid_at", type: "TEXT", description: "Дата платежа" },
    ],
  },
];

export const schemaSql = [
  "CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL, is_active INTEGER NOT NULL);",
  "CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, registered_at TEXT NOT NULL);",
  "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), ordered_at TEXT NOT NULL, status TEXT NOT NULL);",
  "CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id), quantity INTEGER NOT NULL, unit_price REAL NOT NULL);",
  "CREATE TABLE payments (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id), amount REAL NOT NULL, status TEXT NOT NULL, paid_at TEXT NOT NULL);",
].join("\n");

export function createShopData(variant = 0): Record<string, Cell[][]> {
  const shift = variant * 100;
  const products: Cell[][] = [
    [1, "Беспроводная мышь", "Аксессуары", 35, 42, 1],
    [2, "Механическая клавиатура", "Аксессуары", 120, 18, 1],
    [3, "Монитор 27″", "Экраны", 320, 9, 1],
    [4, "Наушники Studio", "Аудио", 85, 0, 1],
    [5, "USB-C хаб", "Аксессуары", 55, 26, 1],
    [6, "Веб-камера", "Аксессуары", 75, 11, 1],
    [7, "Портативная колонка", "Аудио", 60, 14, 1],
    [8, "Настольная лампа", "Для дома", 45, 0, 1],
    [9, "Ноутбук Air", "Компьютеры", 950, 5, 1],
    [10, "Коврик для мыши", "Аксессуары", 15, 70, 1],
    [11, "Клавиатура Classic", "Аксессуары", 40, 0, 0],
    [12, "Монитор 24″", "Экраны", 200, 7, 1],
  ];
  if (variant === 1) {
    products[1][3] = 100;
    products[2][3] = 950;
    products[3][4] = 6;
    products[5][4] = 0;
    products[10][3] = 500;
  }
  if (variant === 2) {
    products[0][3] = 135;
    products[6][3] = 100;
    products[8][5] = 0;
    products[11][3] = 320;
    products.push(
      [13, "Наушники Studio", "Аудио", 85, 0, 1],
      [14, "Зарядная станция", "Аксессуары", 320, 4, 1],
    );
  }
  const customers: Cell[][] = [
    [1, "Анна Смирнова", "Москва", "2025-12-03"],
    [2, "Марк Волков", "Казань", "2025-12-07"],
    [3, "София Белова", "Москва", "2025-12-12"],
    [4, "Даниил Орлов", "Пермь", "2026-01-02"],
    [5, "Алиса Соколова", "Казань", "2026-01-08"],
    [6, "Артём Козлов", "Самара", "2026-01-15"],
    [7, "Ева Новикова", "Пермь", "2026-02-01"],
    [8, "Лев Морозов", "Самара", "2026-02-04"],
    [9, "Мила Лебедева", "Москва", "2026-02-16"],
    [10, "Илья Павлов", "Томск", "2026-03-01"],
  ];
  if (variant === 1) {
    customers[2][1] = "Анна Смирнова";
    customers[9][2] = "Казань";
  }
  if (variant === 2) {
    customers.push([11, "Анна Смирнова", "Омск", "2026-03-02"]);
  }
  const orders: Cell[][] = [
    [1, 1, "2026-01-05", "completed"],
    [2, 2, "2026-01-08", "completed"],
    [3, 3, "2026-01-12", "completed"],
    [4, 1, "2026-01-20", "completed"],
    [5, 4, "2026-01-25", "cancelled"],
    [6, 5, "2026-02-02", "completed"],
    [7, 2, "2026-02-07", "completed"],
    [8, 6, "2026-02-11", "pending"],
    [9, 3, "2026-02-15", "completed"],
    [10, 7, "2026-02-20", "completed"],
    [11, 1, "2026-02-25", "completed"],
    [12, 5, "2026-03-01", "completed"],
    [13, 4, "2026-03-04", "pending"],
    [14, 6, "2026-03-07", "completed"],
    [15, 2, "2026-03-12", "cancelled"],
    [16, 7, "2026-03-16", "completed"],
    [17, 3, "2026-03-19", "completed"],
    [18, 8, "2026-03-22", "pending"],
  ];
  if (variant === 1) {
    orders[0][3] = "cancelled";
    orders[12][3] = "completed";
    orders[17][1] = 9;
  }
  if (variant === 2) {
    orders[3][1] = 3;
    orders[16][2] = "2026-04-01";
  }
  const rawItems = [
    [1, 1, 2, 35],
    [1, 10, 1, 15],
    [2, 2, 1, 110],
    [2, 5, 1, 50],
    [3, 3, 1, 300],
    [4, 4, 1, 80],
    [4, 10, 2, 15],
    [5, 9, 1, 950],
    [6, 7, 2, 60],
    [6, 8, 1, 45],
    [7, 1, 1, 35],
    [7, 6, 1, 75],
    [8, 9, 1, 900],
    [9, 5, 3, 50],
    [10, 12, 1, 190],
    [10, 1, 1, 35],
    [11, 9, 1, 920],
    [11, 2, 1, 120],
    [12, 3, 1, 310],
    [13, 4, 2, 85],
    [14, 6, 1, 70],
    [14, 10, 3, 15],
    [15, 8, 1, 45],
    [16, 7, 1, 55],
    [17, 12, 2, 195],
    [17, 5, 1, 55],
    [18, 2, 1, 120],
  ];
  const items = rawItems.map((row, i) => [i + 1, ...row] as Cell[]);
  if (variant === 1) {
    items[0][3] = 3;
    items[3][4] = 47.5;
    items[16][4] = 810;
  }
  if (variant === 2) {
    items[2][3] = 2;
    items[17][4] = 90;
    items.push([28, 17, 13, 1, 80]);
  }
  const payments: Cell[][] = [];
  for (const order of orders) {
    const id = order[0] as number;
    const total = items
      .filter((item) => item[1] === id)
      .reduce((sum, item) => sum + Number(item[3]) * Number(item[4]), 0);
    if ([5, 8, 13, 15, 18].includes(id)) {
      if ([8, 13, 15].includes(id))
        payments.push([payments.length + 1, id, total, "failed", order[2]]);
      continue;
    }
    if (id === 10) {
      payments.push([payments.length + 1, id, 100, "success", order[2]]);
      payments.push([
        payments.length + 1,
        id,
        total - 100,
        "success",
        order[2],
      ]);
    } else {
      payments.push([
        payments.length + 1,
        id,
        total - (id === 14 ? 20 : 0),
        "success",
        order[2],
      ]);
    }
  }
  if (variant === 1)
    payments.push([payments.length + 1, 18, 120, "success", "2026-03-22"]);
  if (variant === 2)
    payments.push([payments.length + 1, 14, 20, "success", "2026-03-08"]);
  // Different identifiers make answers tied to the visible fixture fail grading.
  for (const row of products) row[0] = Number(row[0]) + shift;
  for (const row of customers) row[0] = Number(row[0]) + shift;
  for (const row of orders) {
    row[0] = Number(row[0]) + shift;
    row[1] = Number(row[1]) + shift;
  }
  for (const row of items) {
    row[0] = Number(row[0]) + shift;
    row[1] = Number(row[1]) + shift;
    row[2] = Number(row[2]) + shift;
  }
  for (const row of payments) {
    row[0] = Number(row[0]) + shift;
    row[1] = Number(row[1]) + shift;
  }
  return { products, customers, orders, order_items: items, payments };
}

export const shopData = createShopData();
export const sqlSchema = Object.fromEntries(
  tables.map((table) => [table.name, table.fields.map((field) => field.name)]),
);
