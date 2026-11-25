const QUIZ_REQUEST_TIMEOUT_MS = 15_000;

/** Bound both the network request and the SDK's wait for an auth token. */
export async function requestQuizData<T>(operation: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Supabase не ответил за 15 секунд. Повторите попытку."));
    }, QUIZ_REQUEST_TIMEOUT_MS);
  });
  try {
    // The race also settles if auth token acquisition never reaches fetch,
    // where an AbortSignal alone would not release the caller.
    return await Promise.race([
      Promise.resolve().then(() => operation(controller.signal)),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
