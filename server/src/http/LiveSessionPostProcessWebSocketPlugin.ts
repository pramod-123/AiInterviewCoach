import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import type { IAppDao } from "../dao/IAppDao.js";
import type { PostProcessClientEvent } from "../live-session/postProcessEventsHub.js";
import { subscribePostProcessEvents } from "../live-session/postProcessEventsHub.js";

type SessionParams = { Params: { id: string } };

const EXTENSION_ORIGIN_RE = /^chrome-extension:\/\//i;
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function originAllowed(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }
  return EXTENSION_ORIGIN_RE.test(origin) || LOCAL_ORIGIN_RE.test(origin);
}

function sendJson(socket: WebSocket, msg: PostProcessClientEvent): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(msg));
  }
}

/**
 * Push live-session post-process status so the sessions UI can drop polling.
 * Path: `WS /api/live-sessions/:id/post-process-events`
 */
export class LiveSessionPostProcessWebSocketPlugin {
  constructor(private readonly db: IAppDao) {}

  register(app: FastifyInstance): void {
    app.get<SessionParams>(
      "/api/live-sessions/:id/post-process-events",
      { websocket: true },
      (socket, request) => {
        this.handleSocket(socket, request);
      },
    );
  }

  private handleSocket(socket: WebSocket, request: FastifyRequest<SessionParams>): void {
    const origin = request.headers.origin;
    if (!originAllowed(typeof origin === "string" ? origin : undefined)) {
      sendJson(socket, { type: "post_process", phase: "error", message: "Origin not allowed." });
      socket.close();
      return;
    }

    const sessionId = request.params.id;
    let unsub: (() => void) | null = null;

    const cleanup = (): void => {
      if (unsub) {
        unsub();
        unsub = null;
      }
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);

    void (async () => {
      const session = await this.db.getLiveSession(sessionId);
      if (!session) {
        sendJson(socket, { type: "post_process", phase: "error", message: "Live session not found." });
        socket.close();
        return;
      }

      const job = session.postProcessJob;
      if (!job) {
        sendJson(socket, { type: "post_process", phase: "waiting" });
      } else if (job.status === "COMPLETED") {
        sendJson(socket, { type: "post_process", phase: "complete", jobId: job.id });
      } else if (job.status === "FAILED") {
        sendJson(socket, {
          type: "post_process",
          phase: "failed",
          jobId: job.id,
          errorMessage: job.errorMessage,
        });
      } else {
        sendJson(socket, { type: "post_process", phase: "processing", jobId: job.id });
      }

      unsub = subscribePostProcessEvents(sessionId, (ev) => {
        sendJson(socket, ev);
      });
    })().catch(() => {
      sendJson(socket, { type: "post_process", phase: "error", message: "Failed to load session." });
      socket.close();
    });
  }
}
