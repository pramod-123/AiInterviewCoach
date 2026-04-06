/**
 * Re-run rubric evaluation for a job that already has speech utterances (and code snapshots) in the DB,
 * then merge the new `evaluation` into `Result.payload`.
 *
 * Usage (from `server/`):
 *   npx tsx scripts/reevaluate-persist-job.ts <jobId | liveSessionId>
 */
import "dotenv/config";
import pino from "pino";
import type { FastifyBaseLogger } from "fastify";
import { appDao, closeAppDatabase, openAppDatabase } from "../src/db.js";
import { mergeJsonPayload } from "../src/dao/dto.js";
import { InterviewEvaluationServiceFactory } from "../src/services/evaluation/InterviewEvaluationServiceFactory.js";

const token = process.argv[2]?.trim();
if (!token) {
  console.error("Usage: npx tsx scripts/reevaluate-persist-job.ts <jobId | liveSessionId>");
  process.exit(1);
}

const log = pino({ level: "info" }) as unknown as FastifyBaseLogger;

await openAppDatabase();

let jobId: string | null = await appDao.findJobIdIfExists(token);
if (!jobId) {
  jobId = await appDao.findFirstJobIdByLiveSessionId(token);
}
if (!jobId) {
  console.error(`No Job with id ${token}, and no Job with liveSessionId ${token}.`);
  await closeAppDatabase();
  process.exit(1);
}

const prev = await appDao.findResultPayloadByJobId(jobId);
if (!prev) {
  console.error(`No Result row / payload for job ${jobId}. Persist transcript and payload first.`);
  await closeAppDatabase();
  process.exit(1);
}

const evaluationFactory = new InterviewEvaluationServiceFactory(process.env, appDao);
const evaluator = evaluationFactory.create(log);

console.log(JSON.stringify({ jobId, token, reevaluate: true }, null, 2));
const evaluation = await evaluator.evaluate({ jobId });

if (evaluation.status !== "complete") {
  console.error(JSON.stringify(evaluation, null, 2));
  await closeAppDatabase();
  process.exit(1);
}

const payload = mergeJsonPayload(prev.payload, { evaluation });
await appDao.upsertResultPayload(jobId, payload);

console.log(JSON.stringify({ jobId, status: evaluation.status, persisted: true }, null, 2));
await closeAppDatabase();
