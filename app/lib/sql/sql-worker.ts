import type { SqlJsStatic } from "sql.js";
import {
  buildDatabase,
  executeQuery,
  gradeQuery,
  friendlyError,
  validateTrainingDatabase,
} from "./engine";
import { defaultTrainingDatabase, parseTrainingDatabase } from "./training-database";

declare function importScripts(...urls: string[]): void;
declare const initSqlJs: (config: {
  locateFile: (file: string) => string;
}) => Promise<SqlJsStatic>;
importScripts("/sql/sql-wasm.js");
const ready = initSqlJs({ locateFile: (file) => "/sql/" + file });

self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: "init" | "run" | "grade" | "validate-database";
    sql?: string;
    taskId?: string;
    database?: unknown;
  }>,
) => {
  const { id, type, sql = "", taskId = "" } = event.data;
  try {
    const SQL = await ready;
    if (type === "init") {
      self.postMessage({ id, data: true });
      return;
    }
    const config = event.data.database === undefined
      ? defaultTrainingDatabase
      : parseTrainingDatabase(event.data.database);
    if (type === "validate-database") {
      validateTrainingDatabase(SQL, config);
      self.postMessage({ id, data: true });
      return;
    }
    if (type === "grade") {
      self.postMessage({ id, data: gradeQuery(SQL, taskId, sql, config) });
      return;
    }
    const db = buildDatabase(SQL, 0, config);
    try {
      self.postMessage({ id, data: executeQuery(db, sql) });
    } finally {
      db.close();
    }
  } catch (error) {
    self.postMessage({ id, error: friendlyError(error) });
  }
};
