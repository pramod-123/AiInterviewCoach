import type { FunctionCall, FunctionDeclaration, FunctionResponse, Tool } from "@google/genai";
import {
  DaoInterviewSessionTools,
  type GetLatestCodeSnippetData,
} from "../agent-tools/InterviewSessionTools.js";
import type { ToolResult } from "../agent-tools/types.js";
import type { IAppDao } from "../dao/IAppDao.js";

/** Context for building Gemini Live connect tools (mirrors {@link InterviewEvaluationAgentToolContext} minus `jobId`). */
export type GeminiLiveInterviewerToolContext = {
  db: IAppDao;
  liveSessionId: string;
};

/**
 * Gemini Live API tools backed by {@link DaoInterviewSessionTools}. `sessionId` is fixed at
 * construction so the model cannot query arbitrary sessions (same pattern as
 * `LangChainInterviewSessionToolPack` in `server/src/services/evaluation/langChainInterviewTools.ts`).
 */
export class GeminiLiveInterviewerSessionToolPack {
  private readonly sessionTools: DaoInterviewSessionTools;

  constructor(
    db: IAppDao,
    private readonly sessionId: string,
  ) {
    this.sessionTools = new DaoInterviewSessionTools(db);
  }

  /** Same payload shape as LangChain `get_latest_code_snippet` (ToolResult in `response`). */
  private toolResultToFunctionResponse<T>(
    id: string,
    name: string,
    result: ToolResult<T>,
  ): FunctionResponse {
    return {
      id,
      name,
      response: result as unknown as Record<string, unknown>,
    };
  }

  /**
   * Declarations for `live.connect` `config.tools` — descriptions aligned with
   * `LangChainInterviewSessionToolPack.asLangChainTools` `get_latest_code_snippet`.
   */
  asGeminiLiveTools(): Tool[] {
    const get_latest_code_snippet: FunctionDeclaration = {
      name: "get_latest_code_snippet",
      description: `Fetch the most recent full editor snapshot stored for this live interview session (end of capture timeline).

Input: none (session is fixed for this bridge).

Output: ToolResult as JSON in the function response — content semantics match the evaluation agent tool.
- ok: true → data.text is the full editor source at the latest capture; data.offsetSeconds is seconds from recording start; data.sequence is the snapshot sequence number.
- ok: false → no snapshots yet, or session not found.
Prefer this over guessing a large timestamp for a hypothetical get_code_at when you need the candidate's final submitted code state.`,
    };

    return [
      {
        functionDeclarations: [get_latest_code_snippet],
      },
    ];
  }

  /**
   * Executes Live API {@link FunctionCall}s against this pack's session and returns
   * {@link FunctionResponse}s for {@link Session.sendToolResponse}.
   */
  async buildFunctionResponsesForCalls(calls: FunctionCall[] | undefined): Promise<FunctionResponse[]> {
    if (calls == null || calls.length === 0) {
      return [];
    }
    const sessionTools = this.sessionTools;
    const sessionId = this.sessionId;
    const out: FunctionResponse[] = [];
    for (const fc of calls) {
      const name = (fc.name ?? "").trim();
      const id = fc.id ?? "";
      if (name === "get_latest_code_snippet") {
        const toolResult = await sessionTools.getLatestCodeSnippet(sessionId);
        out.push(
          this.toolResultToFunctionResponse<GetLatestCodeSnippetData>(
            id,
            "get_latest_code_snippet",
            toolResult,
          ),
        );
      } else {
        out.push({
          id,
          name: name.length > 0 ? name : "unknown_tool",
          response: { error: `Unsupported tool: ${name || "(empty)"}` },
        });
      }
    }
    return out;
  }
}

/** Default inventory for Gemini Live voice interviewer (extend the pack when adding tools). */
export function buildDefaultGeminiLiveInterviewerConnectTools(ctx: GeminiLiveInterviewerToolContext): Tool[] {
  return new GeminiLiveInterviewerSessionToolPack(ctx.db, ctx.liveSessionId).asGeminiLiveTools();
}
