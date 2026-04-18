import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolved filesystem locations for local data and uploads.
 */
export class AppPaths {
  readonly serverRoot: string;
  readonly dataDir: string;
  readonly uploadsDir: string;
  readonly liveSessionsDir: string;

  constructor() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.serverRoot = path.resolve(__dirname, "..", "..");
    this.dataDir = path.join(this.serverRoot, "data");
    this.uploadsDir = path.join(this.dataDir, "uploads");
    this.liveSessionsDir = path.join(this.dataDir, "live-sessions");
  }

  jobUploadDir(jobId: string): string {
    return path.join(this.uploadsDir, jobId);
  }

  liveSessionDir(sessionId: string): string {
    return path.join(this.liveSessionsDir, sessionId);
  }

  /**
   * Hidden JSON next to `server/.env`: API keys and models (extension UI / PUT /api/app-config).
   * Non-empty fields override `process.env` when merged.
   */
  runtimeAppConfigPath(): string {
    return path.join(this.serverRoot, ".app-runtime-config.json");
  }

  /** Shipped preset lists when the runtime file omits an array (`server/.app-runtime-config.defaults.json`). */
  runtimeAppConfigDefaultsPath(): string {
    return path.join(this.serverRoot, ".app-runtime-config.defaults.json");
  }
}
