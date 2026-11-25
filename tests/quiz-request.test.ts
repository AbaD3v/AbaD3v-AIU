import assert from "node:assert/strict";
import { test } from "node:test";
import { requestQuizData } from "../app/quiz/request";

test("a stalled quiz request is aborted and releases the caller for retry", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let signal!: AbortSignal;
  const request = requestQuizData((current) => {
    signal = current;
    return new Promise<never>(() => {});
  });
  const failure = assert.rejects(request, /не ответил за 15 секунд/);
  await Promise.resolve();
  context.mock.timers.tick(15_000);
  await failure;
  assert.equal(signal.aborted, true);
  assert.equal(await requestQuizData(async () => "retried"), "retried");
});

test("settled quiz requests clear their timeout, including a synchronous SDK failure", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let signal!: AbortSignal;
  assert.equal(await requestQuizData(async (current) => { signal = current; return "saved"; }), "saved");
  context.mock.timers.tick(15_000);
  assert.equal(signal.aborted, false);

  await assert.rejects(requestQuizData((current) => {
    signal = current;
    throw new Error("SDK unavailable");
  }), /SDK unavailable/);
  context.mock.timers.tick(15_000);
  assert.equal(signal.aborted, false);
});
