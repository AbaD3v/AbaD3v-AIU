import { test } from "node:test";
import assert from "node:assert/strict";
import { SqlClient } from "../app/lib/sql/client";

class WorkerMock {
  static workers: WorkerMock[] = [];
  onmessage:
    | ((event: {
        data: { id: number; data?: unknown; error?: string };
      }) => void)
    | null = null;
  onerror: (() => void) | null = null;
  messages: { id: number; type: string }[] = [];
  terminated = false;
  constructor() {
    WorkerMock.workers.push(this);
  }
  postMessage(message: { id: number; type: string }) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  answer(data: unknown) {
    this.onmessage?.({ data: { id: this.messages.at(-1)!.id, data } });
  }
}

test("worker initialization survives mount-cleanup-remount and recovers from a crash", async () => {
  const original = globalThis.Worker;
  globalThis.Worker = WorkerMock as unknown as typeof Worker;
  const client = new SqlClient();
  try {
    const first = client.init().catch((error) => error);
    client.destroy();
    const second = client.init();
    await first;
    const worker = WorkerMock.workers.at(-1)!;
    assert.equal(
      worker.terminated,
      false,
      "an old rejection must not terminate the new worker",
    );
    worker.answer(true);
    await second;
    const query = client.run("SELECT 1;");
    await Promise.resolve();
    const result = {
      columns: ["1"],
      rows: [[1]],
      elapsed: 1,
      truncated: false,
    };
    worker.answer(result);
    assert.deepEqual(await query, result);
    worker.onerror?.();
    assert.equal(worker.terminated, true);
    const restarted = client.init();
    WorkerMock.workers.at(-1)!.answer(true);
    await restarted;
  } finally {
    client.destroy();
    globalThis.Worker = original;
  }
});

test("cancelling a query rejects it and a later query runs in a fresh worker", async () => {
  const original = globalThis.Worker;
  globalThis.Worker = WorkerMock as unknown as typeof Worker;
  const client = new SqlClient();
  try {
    const init = client.init();
    const oldWorker = WorkerMock.workers.at(-1)!;
    oldWorker.answer(true);
    await init;
    const slowQuery = client.run(
      "WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n) SELECT sum(x) FROM n;",
    );
    const cancelled = assert.rejects(slowQuery, /Выполнение отменено/);
    await Promise.resolve();
    client.destroy();
    await cancelled;
    assert.equal(oldWorker.terminated, true);
    const recovery = client.run("SELECT 42;");
    const freshWorker = WorkerMock.workers.at(-1)!;
    assert.notEqual(freshWorker, oldWorker);
    oldWorker.answer({ columns: ["bad"], rows: [[0]] });
    freshWorker.answer(true);
    await new Promise((resolve) => setImmediate(resolve));
    const result = {
      columns: ["42"],
      rows: [[42]],
      elapsed: 1,
      truncated: false,
    };
    freshWorker.answer(result);
    assert.deepEqual(await recovery, result);
  } finally {
    client.destroy();
    globalThis.Worker = original;
  }
});
