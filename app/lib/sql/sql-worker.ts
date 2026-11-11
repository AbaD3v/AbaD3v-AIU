import type { SqlJsStatic } from "sql.js";
import {
  buildDatabase,
  executeQuery,
  gradeQuery,
  friendlyError,
} from "./engine";

declare function importScripts(...urls: string[]): void;
declare const initSqlJs: (config: {
  locateFile: (file: string) => string;
}) => Promise<SqlJsStatic>;
importScripts("/sql/sql-wasm.js");
const ready = initSqlJs({ locateFile: (file) => "/sql/" + file });

self.onmessage = async (
  event: MessageEvent<{
    id: number;
    type: "init" | "run" | "grade";
    sql?: string;
    taskId?: string;
  }>,
) => {
  const { id, type, sql = "", taskId = "" } = event.data;
  try {
    const SQL = await ready;
    if (type === "init") {
      self.postMessage({ id, data: true });
      return;
    }
    if (type === "grade") {
      self.postMessage({ id, data: gradeQuery(SQL, taskId, sql) });
      return;
    }
    const db = buildDatabase(SQL);
    try {
      self.postMessage({ id, data: executeQuery(db, sql) });
    } finally {
      db.close();
    }
  } catch (error) {
    self.postMessage({ id, error: friendlyError(error) });
  }
};
