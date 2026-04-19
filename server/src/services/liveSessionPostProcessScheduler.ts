/** Minimal surface used by {@link LiveSessionRoutesController} after a session ends. */
export type LiveSessionPostProcessScheduler = {
  scheduleAfterEnd(sessionId: string): void;
};
