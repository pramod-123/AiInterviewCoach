import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { appDao, runAppTransaction } from "./db.js";
import { buildFastifyLogger } from "./logging/buildFastifyLogger.js";
import { appFileStore } from "./appFileStore.js";
import { AppRuntimeConfigRoutesController } from "./http/AppRuntimeConfigRoutesController.js";
import { JobRoutesController } from "./http/JobRoutesController.js";
import { LiveSessionRoutesController } from "./http/LiveSessionRoutesController.js";
import { getMergedAppEnv } from "./infrastructure/appRuntimeConfig.js";
import { AppPaths } from "./infrastructure/AppPaths.js";
import {
  assertMandatoryFfmpegBinaries,
  assertMandatoryInterviewApiConfig,
} from "./services/mandatoryInterviewApiEnv.js";
import { InterviewEvaluationServiceFactory } from "./services/evaluation/InterviewEvaluationServiceFactory.js";
import { SpeechTranscriptionEvaluationOrchestratorFactory } from "./services/SpeechTranscriptionEvaluationOrchestratorFactory.js";
import { SpeechToTextServiceFactory } from "./services/speech-to-text/SpeechToTextServiceFactory.js";
import {
  setInterviewApiDisableReason,
  setInterviewApiEnabled,
} from "./interviewApiRuntimeState.js";
import { LiveSessionPostProcessor } from "./services/LiveSessionPostProcessor.js";
import { LiveSessionPostProcessWebSocketPlugin } from "./http/LiveSessionPostProcessWebSocketPlugin.js";

/**
 * Composes Fastify plugins and route controllers for the local interview API.
 */
export class InterviewCoachServer {
  private readonly app: FastifyInstance;
  private readonly paths: AppPaths;
  private readonly speechToTextFactory: SpeechToTextServiceFactory;
  private readonly evaluationFactory: InterviewEvaluationServiceFactory;
  private orchestratorFactory!: SpeechTranscriptionEvaluationOrchestratorFactory;
  /**
   * Whether the STT + evaluation stack can be constructed from current merged env (may flip after
   * `PUT /api/app-config` without restarting the process).
   */
  interviewApiEnabled = true;

  /** After at least one successful probe, a failed probe is logged as warn (lost working stack). */
  private interviewApiProbeEverSucceeded = false;

  constructor(
    speechToTextFactory?: SpeechToTextServiceFactory,
    evaluationFactory?: InterviewEvaluationServiceFactory,
  ) {
    this.app = Fastify({
      loggerInstance: buildFastifyLogger(),
      disableRequestLogging: true,
    });
    this.paths = new AppPaths();
    const resolveEnv = () => getMergedAppEnv(this.paths);
    this.speechToTextFactory =
      speechToTextFactory ?? new SpeechToTextServiceFactory(resolveEnv, () => this.paths);
    this.evaluationFactory =
      evaluationFactory ?? new InterviewEvaluationServiceFactory(resolveEnv, appDao);
  }

  get instance(): FastifyInstance {
    return this.app;
  }

  async registerPlugins(): Promise<void> {
    // Restrict CORS to localhost origins only (http/https on 127.0.0.1 or localhost, any port)
    // and Chrome extension origins, which is all that should ever call this local-only server.
    await this.app.register(cors, {
      origin: (origin, cb) => {
        if (
          !origin ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
          /^chrome-extension:\/\//.test(origin)
        ) {
          cb(null, true);
        } else {
          cb(new Error("CORS: origin not allowed"), false);
        }
      },
    });
    await this.app.register(multipart, {
      limits: { fileSize: 500 * 1024 * 1024 },
    });
    await this.app.register(websocket, {
      options: { maxPayload: 8 * 1024 * 1024 },
    });
  }

  /**
   * Registers every HTTP and WebSocket route for this app (live sessions, post-process events, app-config, jobs).
   * Post-process builds the speech + evaluation stack **per run** from current merged env; `interviewApiEnabled`
   * is refreshed on startup, on `GET /api/app-config`, and after a successful `PUT /api/app-config`.
   */
  registerRoutes(): void {
    assertMandatoryFfmpegBinaries();
    this.orchestratorFactory = new SpeechTranscriptionEvaluationOrchestratorFactory(
      this.speechToTextFactory,
      this.evaluationFactory,
      this.app.log,
    );
    const liveSessionPostProcessor = new LiveSessionPostProcessor(
      appDao,
      runAppTransaction,
      this.paths,
      appFileStore,
      this.orchestratorFactory,
      this.app.log,
    );
    this.refreshInterviewApiEnabled();
    const liveSessionRoutes = new LiveSessionRoutesController(
      appDao,
      runAppTransaction,
      this.paths,
      appFileStore,
      liveSessionPostProcessor,
    );
    liveSessionRoutes.register(this.app);
    new LiveSessionPostProcessWebSocketPlugin(appDao).register(this.app);
    new AppRuntimeConfigRoutesController(this.paths, () => this.refreshInterviewApiEnabled()).register(this.app);

    const jobRoutes = new JobRoutesController(appDao);
    jobRoutes.register(this.app);
  }

  /** Recomputes {@link interviewApiEnabled} and the value returned by `GET /api/app-config`. */
  private refreshInterviewApiEnabled(): void {
    const was = this.interviewApiEnabled;
    try {
      const speechAnalysis = this.orchestratorFactory.create();
      assertMandatoryInterviewApiConfig(speechAnalysis);
      this.interviewApiEnabled = true;
      this.interviewApiProbeEverSucceeded = true;
      setInterviewApiDisableReason("");
      if (!was) {
        this.app.log.info("Interview API stack is now available from current runtime configuration.");
      }
    } catch (err) {
      this.interviewApiEnabled = false;
      const message = err instanceof Error ? err.message : String(err);
      setInterviewApiDisableReason(message);
      if (was && this.interviewApiProbeEverSucceeded) {
        const stack = err instanceof Error ? err.stack : undefined;
        this.app.log.warn(
          { errMessage: message, errStack: stack },
          "Interview API stack unavailable (missing Whisper, LLM keys, or evaluation config). Save Server config when fixed; post-process retries on the next session end.",
        );
      }
    }
    setInterviewApiEnabled(this.interviewApiEnabled);
  }

  async listen(port: number, host: string): Promise<void> {
    await this.app.listen({ port, host });
    const startedAt = new Date();
    const url = `http://${host}:${port}`;
    this.app.log.info(
      {
        url,
        host,
        port,
        node: process.version,
        startedAt: startedAt.toISOString(),
        interviewApiEnabled: this.interviewApiEnabled,
      },
      `Server listening on ${url} (started at ${startedAt.toISOString()})`,
    );
  }
}
