const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1:8b";
const DEFAULT_TIMEOUT_MS = 120_000;

export type AiConfig = {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

/**
 * Local-only AI configuration. Everything is optional and the app falls back to
 * the deterministic analyzer when Ollama is not running.
 */
export function getAiConfig(): AiConfig {
  const flag = (process.env.SKILLSTITCH_AI ?? "on").toLowerCase();
  const enabled = !["off", "0", "false", "no"].includes(flag);

  const baseUrl = (process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;

  const parsedTimeout = Number(process.env.OLLAMA_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout >= 5_000 ? parsedTimeout : DEFAULT_TIMEOUT_MS;

  return { enabled, baseUrl, model, timeoutMs };
}
