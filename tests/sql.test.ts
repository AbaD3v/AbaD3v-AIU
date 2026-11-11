import { before, test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { tasks, getTask } from "../app/lib/sql/course";
import {
  buildDatabase,
  compareResults,
  executeQuery,
  gradeQuery,
  MAX_ROWS,
  type QueryResult,
} from "../app/lib/sql/engine";
import { createShopData } from "../app/lib/sql/schema";

let SQL: SqlJsStatic;
before(async () => {
  SQL = await initSqlJs();
});

test("all lessons execute against three valid relational datasets", () => {
  assert.equal(tasks.length, 15);
  for (let variant = 0; variant < 3; variant++) {
    const db = buildDatabase(SQL, variant);
    try {
      assert.deepEqual(db.exec("PRAGMA foreign_key_check;"), []);
      for (const task of tasks) {
        const result = executeQuery(db, task.solution);
        assert.deepEqual(result.columns, task.columns, task.id);
        assert.equal(result.truncated, false, task.id);
      }
    } finally {
      db.close();
    }
  }
  for (const task of tasks)
    assert.equal(gradeQuery(SQL, task.id, task.solution).passed, true, task.id);
});

test("revenue and audit agree with independently calculated business totals", () => {
  for (let variant = 0; variant < 3; variant++) {
    const data = createShopData(variant);
    const completed = data.orders.filter((order) => order[3] === "completed");
    const expectedAudit = completed
      .map((order) => {
        const total = data.order_items
          .filter((item) => item[1] === order[0])
          .reduce((sum, item) => sum + Number(item[3]) * Number(item[4]), 0);
        const paid = data.payments
          .filter(
            (payment) => payment[1] === order[0] && payment[3] === "success",
          )
          .reduce((sum, payment) => sum + Number(payment[2]), 0);
        return [order[0], total, paid];
      })
      .filter((row) => row[1] !== row[2]);
    const db = buildDatabase(SQL, variant);
    try {
      const audit = executeQuery(db, getTask("payment-audit")!.solution);
      assert.deepEqual(audit.rows, expectedAudit);
      const totalRevenue = completed.reduce(
        (sum, order) =>
          sum +
          data.order_items
            .filter((item) => item[1] === order[0])
            .reduce(
              (subtotal, item) => subtotal + Number(item[3]) * Number(item[4]),
              0,
            ),
        0,
      );
      const revenue = executeQuery(db, getTask("monthly-revenue")!.solution);
      assert.equal(
        revenue.rows.reduce((sum, row) => sum + Number(row[1]), 0),
        totalRevenue,
      );
    } finally {
      db.close();
    }
  }
});

test("equivalent queries, aliases and arbitrary unordered results are accepted", () => {
  assert.equal(
    gradeQuery(
      SQL,
      "first-query",
      "SELECT name AS title, price AS amount FROM products ORDER BY id DESC;",
    ).passed,
    true,
  );
  assert.equal(
    gradeQuery(
      SQL,
      "customers-without-orders",
      "SELECT c.id, c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
    ).passed,
    true,
  );
});

test("changed datasets expose boundary and grouping mistakes that pass the visible example", () => {
  const boundary = gradeQuery(
    SQL,
    "premium-products",
    "SELECT name, price FROM products WHERE price >= 100 AND is_active = 1;",
  );
  assert.equal(boundary.checks[0].passed, true);
  assert.equal(boundary.passed, false);
  const grouping = gradeQuery(
    SQL,
    "product-revenue",
    getTask("product-revenue")!.solution.replace(
      "GROUP BY p.id, p.name",
      "GROUP BY p.name",
    ),
  );
  assert.equal(grouping.checks[0].passed, true);
  assert.equal(grouping.checks[2].passed, false);
});

test("literal answers and incorrect aggregation are rejected", () => {
  const data = createShopData();
  const literal = data.products
    .map(
      (product) =>
        "SELECT " +
        "'" +
        String(product[1]).replaceAll("'", "''") +
        "', " +
        product[3],
    )
    .join(" UNION ALL ");
  const hardcoded = gradeQuery(SQL, "first-query", literal);
  assert.equal(hardcoded.checks[0].passed, true);
  assert.equal(hardcoded.passed, false);
  assert.equal(
    gradeQuery(
      SQL,
      "order-totals",
      "SELECT order_id, SUM(unit_price) FROM order_items GROUP BY order_id;",
    ).passed,
    false,
  );
  assert.equal(
    gradeQuery(
      SQL,
      "payment-audit",
      "SELECT o.id, ROUND(SUM(i.quantity*i.unit_price),2), COALESCE(SUM(p.amount),0) FROM orders o JOIN order_items i ON i.order_id=o.id LEFT JOIN payments p ON p.order_id=o.id AND p.status='success' WHERE o.status='completed' GROUP BY o.id HAVING ROUND(SUM(i.quantity*i.unit_price),2) != COALESCE(SUM(p.amount),0);",
    ).passed,
    false,
  );
});

test("comparison preserves duplicates, NULL, column order and required ordering", () => {
  const result = (rows: QueryResult["rows"]): QueryResult => ({
    columns: ["x"],
    rows,
    elapsed: 0,
    truncated: false,
  });
  assert.equal(
    compareResults(result([[1], [1], [2]]), result([[1], [2], [2]])).passed,
    false,
  );
  assert.equal(
    compareResults(result([[null]]), result([["NULL"]])).passed,
    false,
  );
  assert.equal(compareResults(result([[1]]), result([["1"]])).passed, false);
  assert.equal(
    compareResults(result([[2], [1]]), result([[1], [2]])).passed,
    true,
  );
  assert.equal(
    compareResults(result([[2], [1]]), result([[1], [2]]), true).passed,
    false,
  );
  assert.equal(
    compareResults(result([[0.1 + 0.2]]), result([[0.3]])).passed,
    true,
  );
  assert.equal(
    gradeQuery(SQL, "first-query", "SELECT price, name FROM products;").passed,
    false,
  );
});

test("real parser handles semicolons in values and enforces one read-only statement", () => {
  const db = buildDatabase(SQL);
  try {
    assert.deepEqual(
      executeQuery(
        db,
        "-- header\n/* comment */ SELECT 'a;b' AS value; -- tail",
      ).rows,
      [["a;b"]],
    );
    assert.deepEqual(
      executeQuery(db, "WITH x AS (SELECT 3 AS n) SELECT n FROM x;").rows,
      [[3]],
    );
    for (const sql of [
      "",
      "DELETE FROM products;",
      "PRAGMA query_only=OFF;",
      "WITH x AS (SELECT 1) DELETE FROM products;",
      "SELECT 1; SELECT 2;",
      "SELECT 1; DELETE FROM products;",
      "SELECT missing FROM products;",
    ]) {
      assert.throws(() => executeQuery(db, sql), sql);
    }
    assert.deepEqual(executeQuery(db, "SELECT COUNT(*) FROM products;").rows, [
      [12],
    ]);
    assert.throws(
      () => executeQuery(db, "SELECT " + " ".repeat(20000) + "1"),
      /длинный/,
    );
    for (let i = 0; i < 100; i++)
      assert.equal(executeQuery(db, "SELECT 1;").rows[0][0], 1);
  } finally {
    db.close();
  }
});

test("large results are capped without poisoning the next request", () => {
  const db = buildDatabase(SQL);
  try {
    const result = executeQuery(
      db,
      "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1005) SELECT x FROM n;",
    );
    assert.equal(result.rows.length, MAX_ROWS);
    assert.equal(result.truncated, true);
    assert.deepEqual(executeQuery(db, "SELECT 42;").rows, [[42]]);
  } finally {
    db.close();
  }
});
