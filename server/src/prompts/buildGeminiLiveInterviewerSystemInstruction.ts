import { PromptLoader } from "./PromptLoader.js";

const loader = new PromptLoader();

/**
 * Full system instruction for Gemini Live: session {@link InterviewLiveSession.question} first,
 * then static prompt from `agents/gemini-live-interviewer/AGENT.md`.
 */
export function buildGeminiLiveInterviewerSystemInstruction(problemText: string | null | undefined): string {
  const basePrompt = loader.loadAgentSync("gemini-live-interviewer");
  const problem =
    problemText && problemText.trim().length > 0
      ? problemText.trim()
      : "No problem statement was provided on the session; infer context only from what the candidate says.";
  return [problem, "", basePrompt].join("\n");
}
