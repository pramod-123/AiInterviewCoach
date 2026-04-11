import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { IAppDao } from "../dao/IAppDao.js";
import { CodeSnapshotPresenter } from "../presenters/CodeSnapshotPresenter.js";
import { SpeechUtterancePresenter } from "../presenters/SpeechUtterancePresenter.js";

type InterviewIdParams = { Params: { id: string } };

/**
 * Poll interview job result (live sessions and any legacy rows). Classic `POST /api/interviews`
 * video upload has been removed.
 */
export class JobRoutesController {
  constructor(private readonly db: IAppDao) {}

  register(app: FastifyInstance): void {
    app.get<InterviewIdParams>("/api/interviews/:id", (request, reply) =>
      this.handleGetInterview(request, reply),
    );
  }

  private async handleGetInterview(
    request: FastifyRequest<InterviewIdParams>,
    reply: FastifyReply,
  ): Promise<void> {
    const { id } = request.params;

    const job = await this.db.findJobDetail(id);

    if (!job) {
      return void reply.code(404).send({ error: "Interview not found." });
    }

    const speechTranscript = SpeechUtterancePresenter.toDtoList(job.speechUtterances);
    const codeSnapshots = CodeSnapshotPresenter.toDtoList(job.codeSnapshots);

    if (!job.result) {
      const fromLiveSession = job.liveSession != null;
      const message =
        job.status === "FAILED"
          ? job.errorMessage ?? "Processing failed."
          : job.status === "PROCESSING"
            ? fromLiveSession
              ? "Processing live session (merged recording, speech-to-text, code-snapshot timeline, evaluation)…"
              : "Processing…"
            : "Result not ready yet.";

      return void reply.code(202).send({
        id: job.id,
        status: job.status,
        message,
        errorMessage: job.errorMessage,
        liveSessionId: job.liveSessionId,
        speechTranscript,
        codeSnapshots,
        transcripts: speechTranscript,
      });
    }

    return void reply.send({
      id: job.id,
      status: job.status,
      result: job.result.payload,
      createdAt: job.result.createdAt.toISOString(),
      liveSessionId: job.liveSessionId,
      speechTranscript,
      codeSnapshots,
      transcripts: speechTranscript,
    });
  }
}
