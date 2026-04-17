import type { LiveRealtimeBridgeLogger } from "../LiveRealtimeBridgeHandler.js";
import { formatCandidateEditorSnapshotForGeminiLive } from "../geminiLiveEditorFormat.js";

type UpstreamSend = { send(data: string): void; readyState: number };

const WS_OPEN = 1;

/** Same JSON shapes as the Gemini Live client inbound handler; forwarded as OpenAI Realtime client events. */
export type OpenAILiveClientMessage =
  | { type: "audio"; data: string; mimeType?: string }
  | { type: "editorCode"; code: string }
  | { type: "text"; text: string }
  | { type: "audioStreamEnd"; value?: boolean }
  | { type: "ping" };

function sendJson(upstream: UpstreamSend, evt: Record<string, unknown>): void {
  if (upstream.readyState !== WS_OPEN) {
    return;
  }
  try {
    upstream.send(JSON.stringify(evt));
  } catch {
    /* ignore */
  }
}

/**
 * Parses extension JSON and sends OpenAI Realtime client events on the upstream WebSocket.
 * Input audio must be **PCM16 little-endian mono at 24 kHz** per OpenAI Realtime (`pcm16`).
 */
export function applyOpenAILiveClientJson(
  upstream: UpstreamSend,
  raw: string,
  log: LiveRealtimeBridgeLogger,
  sessionId: string,
  /** Per-bridge flag so 16 kHz mismatch is logged at most once. */
  warnOnce?: { warnedInputRate16k?: boolean },
): void {
  let parsed: OpenAILiveClientMessage;
  try {
    parsed = JSON.parse(raw) as OpenAILiveClientMessage;
  } catch {
    log.warn({ sessionId, raw: raw.slice(0, 120) }, "openai realtime: invalid JSON from client");
    return;
  }

  if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
    return;
  }

  const recordSend = (snapshot: Record<string, unknown>): void => {
    log.debug({ sessionId, ...snapshot }, "openai realtime: client send");
  };

  switch (parsed.type) {
    case "ping":
      return;
    case "audio": {
      if (typeof parsed.data === "string" && parsed.data.length > 0) {
        const mimeType = parsed.mimeType?.trim() || "audio/pcm;rate=16000";
        if (!warnOnce?.warnedInputRate16k && mimeType.includes("16000")) {
          if (warnOnce) {
            warnOnce.warnedInputRate16k = true;
          }
          log.warn(
            { sessionId },
            "openai realtime: client audio claims 16 kHz; OpenAI Realtime pcm16 expects 24 kHz mono — verify capture settings when using LIVE_REALTIME_PROVIDER=openai",
          );
        }
        sendJson(upstream, { type: "input_audio_buffer.append", audio: parsed.data });
        recordSend({
          atMs: Date.now(),
          kind: "input_audio_buffer.append",
          audioDataChars: parsed.data.length,
          mimeType,
        });
      }
      break;
    }
    case "editorCode": {
      if (typeof parsed.code === "string") {
        const wrapped = formatCandidateEditorSnapshotForGeminiLive(parsed.code);
        sendJson(upstream, {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: wrapped }],
          },
        });
        sendJson(upstream, { type: "response.create" });
        recordSend({
          atMs: Date.now(),
          kind: "conversation.item.create+response.create",
          rawCodeChars: parsed.code.length,
        });
      }
      break;
    }
    case "text": {
      if (typeof parsed.text === "string" && parsed.text.length > 0) {
        const text = parsed.text;
        sendJson(upstream, {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text }],
          },
        });
        sendJson(upstream, { type: "response.create" });
        recordSend({ atMs: Date.now(), kind: "text+response.create", textChars: text.length });
      }
      break;
    }
    case "audioStreamEnd": {
      sendJson(upstream, { type: "input_audio_buffer.commit" });
      recordSend({ atMs: Date.now(), kind: "input_audio_buffer.commit" });
      break;
    }
    default:
      break;
  }
}
