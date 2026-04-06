/**
 * Smoke-test {@link DaoInterviewSessionTools.getTranscriptionInTimeRange} against the DB
 * selected by DATABASE_URL (defaults to server data layout via db.ts).
 *
 * Usage:
 *   DATABASE_URL="file:/path/to/app.db" npx tsx scripts/inspect-transcription-tool.ts
 */
import { appDao, closeAppDatabase, openAppDatabase } from "../src/db.js";
import { DaoInterviewSessionTools } from "../src/agent-tools/InterviewSessionTools.js";

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? "(default from db.ts)";
  console.log("DATABASE_URL:", dbUrl);

  await openAppDatabase();

  try {
    const sessionId = await appDao.findLatestLiveSessionId();

    if (!sessionId) {
      console.log("No InterviewLiveSession rows — cannot run getTranscriptionInTimeRange.");
      return;
    }

    const job = await appDao.findFirstJobIdByLiveSessionId(sessionId);

    if (!job) {
      console.log(`Latest session ${sessionId} has no linked Job — cannot run tool.`);
      return;
    }

    const tools = new DaoInterviewSessionTools(appDao);
    const r = await tools.getTranscriptionInTimeRange(sessionId, job, 0, 86400);

    if (!r.ok) {
      console.log("Tool result:", JSON.stringify(r, null, 2));
      return;
    }

    const segs = r.data.segments;
    const withLabel = segs.filter((s) => s.speakerLabel != null && String(s.speakerLabel).trim() !== "");
    const nullLabel = segs.length - withLabel.length;
    const byLabel = [...new Set(withLabel.map((s) => s.speakerLabel))].sort();

    console.log(JSON.stringify({ sessionId, jobId: job, segmentCount: segs.length, nullSpeakerLabelCount: nullLabel, distinctNonNullLabels: byLabel, sample: segs.slice(0, 5) }, null, 2));
  } finally {
    await closeAppDatabase();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
