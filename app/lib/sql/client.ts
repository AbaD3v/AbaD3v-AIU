import type { GradeResult, QueryResult } from "./engine";

export class SqlClient {
  private worker: Worker | null = null;
  private initialized: Promise<void> | null = null;
  private nextId = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  init(): Promise<void> {
    if (this.initialized) return this.initialized;
    try {
      const worker = new Worker("/sql/worker.js");
      this.worker = worker;
      worker.onmessage = (event) => {
        if (this.worker !== worker) return;
        const request = this.pending.get(event.data.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(event.data.id);
        if (event.data.error) request.reject(new Error(event.data.error));
        else request.resolve(event.data.data);
      };
      worker.onerror = () => {
        if (this.worker === worker)
          this.destroy(
            "Не удалось загрузить SQL-движок. Проверьте соединение и повторите попытку.",
          );
      };
      this.initialized = this.send("init", {}, 15000)
        .then(() => undefined)
        .catch((error) => {
          if (this.worker === worker) this.destroy();
          throw error;
        });
    } catch {
      return Promise.reject(
        new Error(
          "Браузер не смог запустить SQL-движок. Попробуйте обновить страницу.",
        ),
      );
    }
    return this.initialized;
  }

  private send(
    type: string,
    payload: object,
    timeout = 3500,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const worker = this.worker;
      if (!worker) {
        reject(new Error("SQL-движок ещё не готов. Повторите запуск."));
        return;
      }
      const id = ++this.nextId;
      const timer = setTimeout(() => {
        if (this.worker === worker)
          this.destroy(
            "Запрос выполнялся слишком долго и был остановлен. Проверьте соединения таблиц или ограничьте результат через LIMIT.",
          );
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ id, type, ...payload });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error("Не удалось отправить SQL-запрос."),
        );
      }
    });
  }

  async run(sql: string): Promise<QueryResult> {
    await this.init();
    return this.send("run", { sql }) as Promise<QueryResult>;
  }

  async grade(taskId: string, sql: string): Promise<GradeResult> {
    await this.init();
    return this.send("grade", { taskId, sql }) as Promise<GradeResult>;
  }

  destroy(message = "Выполнение отменено.") {
    this.worker?.terminate();
    this.worker = null;
    this.initialized = null;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
  }
}
