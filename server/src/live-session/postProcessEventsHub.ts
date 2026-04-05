import { EventEmitter } from "node:events";

/** Server → browser on `/api/live-sessions/:id/post-process-events`. */
export type PostProcessClientEvent =
  | { type: "post_process"; phase: "waiting" }
  | { type: "post_process"; phase: "processing"; jobId: string }
  | { type: "post_process"; phase: "complete"; jobId: string }
  | { type: "post_process"; phase: "failed"; jobId: string; errorMessage: string | null }
  | { type: "post_process"; phase: "error"; message: string };

const hub = new EventEmitter();
hub.setMaxListeners(200);

function channel(sessionId: string): string {
  return `live-session:${sessionId}`;
}

export function notifyPostProcessEvent(sessionId: string, event: PostProcessClientEvent): void {
  hub.emit(channel(sessionId), event);
}

export function subscribePostProcessEvents(
  sessionId: string,
  handler: (event: PostProcessClientEvent) => void,
): () => void {
  const ch = channel(sessionId);
  const fn = (ev: PostProcessClientEvent) => {
    handler(ev);
  };
  hub.on(ch, fn);
  return () => {
    hub.off(ch, fn);
  };
}
