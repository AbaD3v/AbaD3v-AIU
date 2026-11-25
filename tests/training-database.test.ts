import { test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { tasks } from "../app/lib/sql/course";
import { buildDatabase, executeQuery, gradeQuery, validateTrainingDatabase } from "../app/lib/sql/engine";
import { createShopData, tables } from "../app/lib/sql/schema";
import { parseTrainingDatabase, trainingSql, trainingTask } from "../app/lib/sql/training-database";

test("renaming the training schema and editing rows preserves all lesson checks", async () => {
  const SQL = await initSqlJs();
  const { products } = createShopData();
  products[0][1] = "Новый товар";
  products[0][3] = 222.5;
  products.push([50, "Дополнительный товар", "Аудио", 150, 9, 1]);
  const names = Object.fromEntries(tables.flatMap(table =>
    [table.name, ...table.fields.map(field => field.name)].map(name => [name, "demo_" + name]),
  ));
  const config = parseTrainingDatabase({ names, rows: { products } });
  validateTrainingDatabase(SQL, config);
  for (const task of tasks) {
    assert.equal(gradeQuery(SQL, task.id, trainingTask(task, config).solution, config).passed, true, task.id);
  }

  for (let variant = 0; variant < 3; variant++) {
    const db = buildDatabase(SQL, variant, config);
    try {
      const reply = executeQuery(db, "SELECT demo_name, demo_price FROM demo_products WHERE demo_id = " + (1 + variant * 100));
      assert.deepEqual(reply.rows, [["Новый товар", 222.5]]);
      assert.deepEqual(db.exec("PRAGMA foreign_key_check;"), []);
    } finally {
      db.close();
    }
  }
  assert.equal(trainingSql("SELECT name FROM products WHERE name = 'products'", config),
    'SELECT "demo_name" FROM "demo_products" WHERE "demo_name" = \'products\'');
});

test("training database validation rejects duplicate names and broken relationships", async () => {
  assert.throws(() => parseTrainingDatabase({ names: { products: "catalog", customers: "catalog" }, rows: {} }), /имя/);
  const SQL = await initSqlJs();
  const { orders } = createShopData();
  orders[0][1] = 999;
  const config = parseTrainingDatabase({ names: {}, rows: { orders } });
  assert.throws(() => validateTrainingDatabase(SQL, config), /orders: FOREIGN KEY/);
});
