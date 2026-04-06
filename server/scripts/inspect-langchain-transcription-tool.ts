/**
 * Invoke LangChain {@link buildDefaultInterviewEvaluationTools} `get_transcription_in_timerange`
 * (same path the single-agent evaluator uses).
 *
 * Usage:
 *   DATABASE_URL="file:/path/to/app.db" npx tsx scripts/inspect-langchain-transcription-tool.ts
 */
import { appDao, closeAppDatabase, openAppDatabase } from "../src/db.js";
import { buildDefaultInterviewEvaluationTools } from "../src/services/evaluation/langChainInterviewTools.js";

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL ?? "(default from db.ts)";
  console.log("DATABASE_URL:", dbUrl);

  await openAppDatabase();

  try {
    const sessionId = await appDao.findLatestLiveSessionId();
    if (!sessionId) {
      console.log("No InterviewLiveSession rows — cannot run LangChain tool.");
      return;
    }

    const jobId = await appDao.findFirstJobIdByLiveSessionId(sessionId);
    if (!jobId) {
      console.log(`Session ${sessionId} has no linked Job — cannot run tool.`);
      return;
    }

    const tools = buildDefaultInterviewEvaluationTools({
      db: appDao,
      liveSessionId: sessionId,
      jobId,
    });

    const trTool = tools.find((t) => t.name === "get_transcription_in_timerange");
    if (!trTool) {
      console.error("get_transcription_in_timerange not found in tool pack.");
      process.exit(1);
    }

    const raw = await trTool.invoke({
      startTimeSec: 0,
      endTimeSec: null,
      speakerLabel: null,
    });

    const contentStr = typeof raw === "string" ? raw : JSON.stringify(raw);
    const parsed = JSON.parse(contentStr) as {
      ok: boolean;
      data?: { segments: Array<{ speakerLabel: string | null; text: string; sequence: number }> };
      error?: string;
    };

    if (!parsed.ok || !parsed.data) {
      console.log("Tool output:", contentStr);
      return;
    }

    const segs = parsed.data.segments;
    const nullCount = segs.filter((s) => s.speakerLabel == null).length;
    const distinct = [...new Set(segs.map((s) => s.speakerLabel))];

    console.log(
      JSON.stringify(
        {
          langChainTool: "get_transcription_in_timerange",
          sessionId,
          jobId,
          contentType: typeof raw,
          segmentCount: segs.length,
          nullSpeakerLabelCount: nullCount,
          distinctSpeakerLabels: distinct,
          firstTwoSegments: segs.slice(0, 2),
        },
        null,
        2,
      ),
    );

    const rawFiltered = await trTool.invoke({
      startTimeSec: 0,
      endTimeSec: 100,
      speakerLabel: "interviewer",
    });
    const filteredStr = typeof rawFiltered === "string" ? rawFiltered : JSON.stringify(rawFiltered);
    const filtered = JSON.parse(filteredStr) as typeof parsed;
    if (filtered.ok && filtered.data) {
      console.log(
        "\nFiltered window [0,100s] speakerLabel=interviewer:",
        JSON.stringify(
          {
            segmentCount: filtered.data.segments.length,
            labels: filtered.data.segments.map((s) => s.speakerLabel),
          },
          null,
          2,
        ),
      );
    }
  } finally {
    await closeAppDatabase();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
