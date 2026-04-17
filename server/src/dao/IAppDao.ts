import type {
  CodeSnapshotItem,
  CodeSnapshotSource,
  JobDetail,
  JobEvaluationLoad,
  JobStatus,
  JobWithInterviewAudio,
  JsonValue,
  LiveSessionContent,
  LiveSessionGetItem,
  LiveSessionListItem,
  LiveSessionPatchItem,
  LiveSessionStatus,
  LiveVideoChunkItem,
  LiveVoiceRealtimeAudioChunkItem,
  LiveVoiceRealtimeAudioChunkMeta,
  SpeechUtteranceInsert,
  SpeechUtteranceItem,
} from "./dto.js";

/**
 * Application data access: explicit query/command methods only — no ORM delegates.
 * Connection lifecycle, driver-specific pragmas, and multi-statement transactions live in
 * `db.ts` (application wiring), not on this interface.
 */
export interface IAppDao {
  // --- Jobs ---
  findFirstJobIdByLiveSessionId(liveSessionId: string): Promise<string | null>;
  /** Returns job id if a row exists (for CLI resolution). */
  findJobIdIfExists(jobId: string): Promise<string | null>;
  findJobDetail(jobId: string): Promise<JobDetail | null>;
  findJobWithInterviewAudio(jobId: string): Promise<JobWithInterviewAudio | null>;
  findJobLiveSessionId(jobId: string): Promise<{ liveSessionId: string | null } | null>;
  findJobForEvaluationLoad(jobId: string): Promise<JobEvaluationLoad | null>;
  createJobFailedLiveSession(params: {
    id: string;
    liveSessionId: string;
    errorMessage: string;
  }): Promise<void>;
  createJobProcessingLiveSessionWithVideo(params: {
    id: string;
    liveSessionId: string;
    videoFilePath: string;
    videoSizeBytes: number;
  }): Promise<void>;
  updateJob(
    jobId: string,
    data: { status?: JobStatus; errorMessage?: string | null },
  ): Promise<void>;
  upsertJobProcessingShell(jobId: string): Promise<void>;
  deleteJobsByLiveSessionId(liveSessionId: string): Promise<number>;

  // --- Live sessions ---
  listLiveSessions(): Promise<LiveSessionListItem[]>;
  createLiveSession(params: {
    id: string;
    status: LiveSessionStatus;
    liveInterviewerEnabled: boolean;
  }): Promise<void>;
  /** Atomically creates a session with nested video chunks and live code snapshots (fixtures / seed scripts). */
  createLiveSessionWithChunksAndSnapshots(params: {
    id: string;
    status: LiveSessionStatus;
    liveInterviewerEnabled: boolean;
    question: string | null;
    videoChunks: { sequence: number; filePath: string; mimeType: string; sizeBytes: number }[];
    codeSnapshots: { sequence: number; code: string; offsetSeconds: number; capturedAt: Date }[];
  }): Promise<void>;
  getLiveSession(id: string): Promise<LiveSessionGetItem | null>;
  getLiveSessionPatch(id: string): Promise<LiveSessionPatchItem | null>;
  getLiveSessionContent(id: string): Promise<LiveSessionContent | null>;
  updateLiveSessionQuestion(id: string, question: string): Promise<void>;
  updateLiveSessionStatus(id: string, status: LiveSessionStatus): Promise<void>;
  /** Fields needed to authorize and configure `/api/live-sessions/:id/realtime` (any voice provider). */
  getLiveSessionForRealtimeBridge(id: string): Promise<{
    id: string;
    status: LiveSessionStatus;
    liveInterviewerEnabled: boolean;
    question: string | null;
  } | null>;
  findLiveSessionIdForTools(id: string): Promise<{ id: string } | null>;
  getLiveSessionQuestionText(id: string): Promise<{ question: string | null } | null>;
  getLiveSessionMetadataForTools(id: string): Promise<{
    id: string;
    status: LiveSessionStatus;
    liveInterviewerEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    hasQuestionSaved: boolean;
    postProcessJobId: string | null;
    /** End time of the last persisted STT utterance on the job timeline (seconds); null if no job or no utterances. */
    postProcessTranscriptEndSec: number | null;
    videoChunkCount: number;
    liveCodeSnapshotCount: number;
  } | null>;
  /**
   * Deletes the linked post-process job row(s) for this session (cascades job children), then the
   * live session row (cascades live video chunks, code snapshots, realtime PCM chunks).
   * @returns Number of live session rows removed (0 or 1).
   */
  deleteLiveSessionById(id: string): Promise<number>;
  /** Most recently updated session id, or null if none. */
  findLatestLiveSessionId(): Promise<string | null>;

  /** Sets `voiceRealtimeBridgeOpenedAtWallMs` on the live session once (first realtime bridge open). */
  setVoiceRealtimeBridgeOpenedAtIfUnset(sessionId: string, wallMs: number): Promise<void>;
  /** Millisecond wall time when the voice bridge opened; null if capture never started. */
  getVoiceRealtimeBridgeOpenedAtWallMs(sessionId: string): Promise<number | null>;
  /** Sets `recordingStartedAtWallMs` once (extension calls right after tab MediaRecorder starts). */
  setLiveSessionRecordingStartedAtWallMsIfUnset(sessionId: string, wallMs: number): Promise<void>;
  /** Server wall ms for recording t≈0 when set; otherwise stitch falls back to first video chunk `createdAt`. */
  getLiveSessionRecordingStartedAtWallMs(sessionId: string): Promise<number | null>;
  insertLiveVoiceRealtimeAudioChunk(params: {
    sessionId: string;
    pcmS16le: Buffer;
    sampleRate: number;
    receivedAtWallMs: number;
    offsetFromBridgeOpenMs: number;
  }): Promise<void>;
  aggregateMaxLiveVoiceRealtimeAudioChunkSequence(sessionId: string): Promise<number | null>;
  countLiveVoiceRealtimeAudioChunks(sessionId: string): Promise<number>;
  /**
   * Keyset page of realtime voice PCM rows ordered by `sequence` (use `afterSequence` = last row’s `sequence` from the prior page).
   * `limit` is clamped to 10_000 per query.
   */
  findLiveVoiceRealtimeAudioChunksPage(params: {
    sessionId: string;
    afterSequence: number | null;
    limit: number;
  }): Promise<LiveVoiceRealtimeAudioChunkItem[]>;

  /**
   * All voice chunk rows for a session as lightweight metadata (byte length only, no PCM blob).
   * Used by stitch to sort and batch-fetch PCM without holding the full session in RAM.
   */
  listLiveVoiceRealtimeAudioChunkMetas(sessionId: string): Promise<LiveVoiceRealtimeAudioChunkMeta[]>;

  /** Load PCM rows for the given `sequence` values (e.g. one stitch batch). */
  findLiveVoiceRealtimeAudioChunksBySequences(
    sessionId: string,
    sequences: readonly number[],
  ): Promise<LiveVoiceRealtimeAudioChunkItem[]>;

  // --- Live video chunks ---
  findLiveVideoChunksOrdered(sessionId: string): Promise<LiveVideoChunkItem[]>;
  getFirstLiveVideoChunkCreatedAt(sessionId: string): Promise<Date | null>;
  aggregateMaxLiveVideoSequence(sessionId: string): Promise<number>;
  createLiveVideoChunk(params: {
    sessionId: string;
    sequence: number;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<void>;

  // --- Live code snapshots (tab capture) ---
  findLiveCodeSnapshotsForSession(sessionId: string): Promise<
    { code: string; offsetSeconds: number; sequence: number }[]
  >;
  /**
   * Latest live editor snapshot at or before `timestampSec` (`offsetSeconds` desc, then `sequence` desc).
   * With a snapshot at t≈0, a row exists for typical `timestampSec >= 0` when the session has data.
   */
  findLiveCodeSnapshotAtOrBefore(
    sessionId: string,
    timestampSec: number,
  ): Promise<{ code: string; offsetSeconds: number } | null>;
  countLiveCodeSnapshotsForSession(sessionId: string): Promise<number>;
  aggregateMaxLiveCodeSnapshotSequence(sessionId: string): Promise<number>;
  createLiveCodeSnapshot(params: {
    sessionId: string;
    sequence: number;
    code: string;
    offsetSeconds: number;
    capturedAt: Date;
  }): Promise<void>;

  // --- Speech utterances ---
  countSpeechUtterancesForJob(jobId: string): Promise<number>;
  deleteSpeechUtterancesByJobId(jobId: string): Promise<void>;
  createSpeechUtterances(data: SpeechUtteranceInsert[]): Promise<void>;
  /**
   * Ordered STT rows for a job. When `opts.speakerLabelNormalized` is set (e.g. `INTERVIEWER`),
   * only rows whose stored label matches after the same normalization as SQL
   * `UPPER(REPLACE(TRIM(speakerLabel), ' ', '_'))` are returned.
   */
  findSpeechUtterancesForJobOrdered(
    jobId: string,
    opts?: { speakerLabelNormalized?: string },
  ): Promise<SpeechUtteranceItem[]>;

  /** Jobs with non-null `liveSessionId`, for CLI heuristics. */
  findJobsLinkedToLiveSessionsWithUtteranceCounts(): Promise<
    { id: string; liveSessionId: string; speechUtteranceCount: number }[]
  >;
  /** Live tab-capture snapshot counts per session id. */
  countLiveCodeSnapshotsBySessionIds(
    sessionIds: string[],
  ): Promise<{ sessionId: string; count: number }[]>;

  // --- Job code snapshots ---
  deleteJobCodeSnapshotsBySource(jobId: string, source: CodeSnapshotSource): Promise<void>;
  createJobCodeSnapshots(
    rows: {
      jobId: string;
      source: CodeSnapshotSource;
      offsetMs: number;
      text: string;
      sequence: number;
    }[],
  ): Promise<void>;
  findJobCodeSnapshotsBySource(
    jobId: string,
    source: CodeSnapshotSource,
  ): Promise<CodeSnapshotItem[]>;

  // --- Interview audio ---
  upsertInterviewAudio(params: {
    jobId: string;
    filePath: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    durationSeconds: number | null;
  }): Promise<void>;
  updateInterviewAudioDuration(jobId: string, durationSeconds: number | null): Promise<void>;

  // --- Interview video ---
  updateInterviewVideoSizeBytes(jobId: string, sizeBytes: number): Promise<void>;

  // --- Result ---
  findResultPayloadByJobId(jobId: string): Promise<{ payload: JsonValue } | null>;
  upsertResultPayload(jobId: string, payload: JsonValue): Promise<void>;
}
