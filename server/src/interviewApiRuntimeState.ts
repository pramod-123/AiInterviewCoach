/** Set when the Fastify server refreshes readiness; read by GET `/api/app-config`. */
let interviewApiEnabled = true;

/** Last `SpeechTranscriptionEvaluationOrchestratorFactory.create` / assert failure (truncated); empty when enabled. */
let interviewApiDisableReason = "";

const REASON_MAX = 600;

export function setInterviewApiEnabled(value: boolean): void {
  interviewApiEnabled = value;
}

export function getInterviewApiEnabled(): boolean {
  return interviewApiEnabled;
}

export function setInterviewApiDisableReason(message: string): void {
  const t = message.trim();
  interviewApiDisableReason = t.length > REASON_MAX ? `${t.slice(0, REASON_MAX)}…` : t;
}

export function getInterviewApiDisableReason(): string {
  return interviewApiDisableReason;
}
