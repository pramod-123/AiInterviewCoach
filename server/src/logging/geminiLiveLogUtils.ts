/**
 * Logs each client-bound Live payload as-is (shallow copy). Full `text`, `data`, etc. — logs can be huge.
 */
export function summarizeGeminiLiveClientPayloadsForLog(payloads: Record<string, unknown>[]): unknown[] {
  return payloads.map((p) => ({ ...p }));
}
