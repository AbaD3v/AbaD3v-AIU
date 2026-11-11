import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public/sql");
const sqlDir = path.dirname(require.resolve("sql.js"));
await mkdir(target, { recursive: true });
await Promise.all([
  copyFile(path.join(sqlDir, "sql-wasm.js"), path.join(target, "sql-wasm.js")),
  copyFile(
    path.join(sqlDir, "sql-wasm.wasm"),
    path.join(target, "sql-wasm.wasm"),
  ),
  copyFile(path.join(sqlDir, "../LICENSE"), path.join(target, "LICENSE")),
]);
await build({
  entryPoints: [path.join(root, "app/lib/sql/sql-worker.ts")],
  outfile: path.join(target, "worker.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2020",
  minify: true,
});
console.log("SQL worker and SQLite assets are ready.");
