import { describe, expect, it } from "vitest";
import {
  createOpenAIRealtimeMapperState,
  openaiRealtimeServerEventToClientPayloads,
  OPENAI_REALTIME_OUTPUT_AUDIO_MIME,
} from "../../src/live-session/realtime/openai/openaiRealtimeMessageMapper.js";

describe("openaiRealtimeServerEventToClientPayloads", () => {
  it("maps response.audio.delta to modelAudio", () => {
    const state = createOpenAIRealtimeMapperState();
    const payloads = openaiRealtimeServerEventToClientPayloads(
      { type: "response.audio.delta", delta: "AAA" },
      state,
    );
    expect(payloads).toEqual([
      { type: "modelAudio", mimeType: OPENAI_REALTIME_OUTPUT_AUDIO_MIME, data: "AAA" },
    ]);
  });

  it("accumulates output transcript deltas", () => {
    const state = createOpenAIRealtimeMapperState();
    const a = openaiRealtimeServerEventToClientPayloads(
      {
        type: "response.audio_transcript.delta",
        delta: "hel",
        response_id: "r1",
        item_id: "i1",
        content_index: 0,
      },
      state,
    );
    const b = openaiRealtimeServerEventToClientPayloads(
      {
        type: "response.audio_transcript.delta",
        delta: "lo",
        response_id: "r1",
        item_id: "i1",
        content_index: 0,
      },
      state,
    );
    expect(a).toEqual([{ type: "outputTranscription", text: "hel", finished: false }]);
    expect(b).toEqual([{ type: "outputTranscription", text: "hello", finished: false }]);
  });

  it("maps response.audio_transcript.done with finished true", () => {
    const state = createOpenAIRealtimeMapperState();
    const payloads = openaiRealtimeServerEventToClientPayloads(
      {
        type: "response.audio_transcript.done",
        transcript: "hello",
        response_id: "r1",
        item_id: "i1",
        content_index: 0,
      },
      state,
    );
    expect(payloads).toEqual([{ type: "outputTranscription", text: "hello", finished: true }]);
  });

  it("maps function_call output item to toolCall", () => {
    const state = createOpenAIRealtimeMapperState();
    const payloads = openaiRealtimeServerEventToClientPayloads(
      {
        type: "response.output_item.added",
        item: { type: "function_call", name: "lookup" },
      },
      state,
    );
    expect(payloads).toEqual([{ type: "toolCall", names: ["lookup"] }]);
  });

  it("maps response.done completed to lifecycle flags", () => {
    const state = createOpenAIRealtimeMapperState();
    const payloads = openaiRealtimeServerEventToClientPayloads(
      { type: "response.done", response: { status: "completed" } },
      state,
    );
    expect(payloads).toEqual([
      { type: "generationComplete", value: true },
      { type: "turnComplete", value: true },
      { type: "waitingForInput", value: true },
    ]);
  });

  it("maps cancelled turn_detected to interrupted", () => {
    const state = createOpenAIRealtimeMapperState();
    const payloads = openaiRealtimeServerEventToClientPayloads(
      {
        type: "response.done",
        response: { status: "cancelled", status_details: { reason: "turn_detected" } },
      },
      state,
    );
    expect(payloads).toEqual([{ type: "interrupted", value: true }]);
  });
});
