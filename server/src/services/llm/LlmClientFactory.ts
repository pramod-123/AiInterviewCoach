import { AnthropicLlmClient } from "./AnthropicLlmClient.js";
import type { LlmClient } from "./LlmClient.js";
import { OpenAiLlmClient } from "./OpenAiLlmClient.js";

/**
 * Instantiates {@link LlmClient} from env. Backend is **`LLM_PROVIDER`**
 * (`openai` | `anthropic`) with matching API key.
 */
export class LlmClientFactory {
  static create(env: NodeJS.ProcessEnv = process.env): LlmClient {
    const configured = env.LLM_PROVIDER?.trim();
    if (!configured) {
      throw new Error(
        'LLM_PROVIDER is required in .env (set to "openai" or "anthropic" with matching API key).',
      );
    }
    const raw = configured.toLowerCase();
    if (raw === "openai") {
      const client = OpenAiLlmClient.tryCreate(env);
      if (!client) {
        if (!env.OPENAI_API_KEY?.trim()) {
          throw new Error("OPENAI_API_KEY is not set but LLM_PROVIDER=openai.");
        }
        if (!env.OPENAI_MODEL_ID?.trim()) {
          throw new Error("OPENAI_MODEL_ID is not set but LLM_PROVIDER=openai.");
        }
        throw new Error("Could not create OpenAI LLM client.");
      }
      return client;
    }
    if (raw === "anthropic") {
      const client = AnthropicLlmClient.tryCreate(env);
      if (!client) {
        if (!env.ANTHROPIC_API_KEY?.trim()) {
          throw new Error("ANTHROPIC_API_KEY is not set but LLM_PROVIDER=anthropic.");
        }
        if (!env.ANTHROPIC_MODEL_ID?.trim()) {
          throw new Error("ANTHROPIC_MODEL_ID is not set but LLM_PROVIDER=anthropic.");
        }
        throw new Error("Could not create Anthropic LLM client.");
      }
      return client;
    }
    throw new Error(`Unsupported LLM_PROVIDER "${raw}". Use exactly "openai" or "anthropic".`);
  }
}
