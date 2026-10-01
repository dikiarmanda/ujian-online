import { Queue } from "bullmq";
import { createBullConnection } from "./redis";

const globalForQueue = globalThis as unknown as { answerQueue?: Queue };

export const answerQueue =
  globalForQueue.answerQueue ??
  new Queue("answer-flush", { connection: createBullConnection() });

if (process.env.NODE_ENV !== "production") {
  globalForQueue.answerQueue = answerQueue;
}
