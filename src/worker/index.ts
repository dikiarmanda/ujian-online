import "dotenv/config";
import { Worker } from "bullmq";
import { assertRuntimeEnv } from "../server/env";
import { flushAttempt } from "../server/attempts";
import { createBullConnection } from "../server/redis";

assertRuntimeEnv();

const worker = new Worker(
  "answer-flush",
  async (job) => {
    const attemptId = Number(job.data.attemptId);
    if (!attemptId) return;
    await flushAttempt(attemptId);
  },
  { connection: createBullConnection(), concurrency: 8 },
);

worker.on("failed", (job, error) => {
  console.error("Flush jawaban gagal", job?.id, error);
});

console.log("Worker flush jawaban berjalan.");
