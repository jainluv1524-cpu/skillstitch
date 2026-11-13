import { getAiConfig } from "./config";
import type { AiStatus } from "./types";

export type AiErrorCode =
  | "disabled"
  | "unreachable"
  | "timeout"
  | "http_error"
  | "bad_response";

export class AiError extends Error {
  code: AiErrorCode;
  status?: number;

  constructor(code: AiErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AiError";
    this.code = code;
    this.status = status;
  }
}

/** Models often wrap JSON in ```json fences or add a short preamble. Be lenient. */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null;

  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) cleaned = fence[1].trim();

  const candidates = [cleaned];
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(cleaned.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function chatCompletionsUrl(baseUrl: string): string {
  return baseUrl.endsWith("/v1")
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;
}

export async function checkAiStatus(): Promise<AiStatus> {
  const config = getAiConfig();
  const base = {
    enabled: config.enabled,
    model: config.model,
    baseUrl: config.baseUrl,
    models: [] as string[],
  };

  if (!config.enabled) {
    return { ...base, reachable: false, modelAvailable: false };
  }

  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2_500),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`status ${res.status}`);

    const payload = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = (payload.models ?? [])
      .map((model) => String(model.name ?? ""))
      .filter(Boolean);

    const modelAvailable = models.some((name) => {
      const shortName = name.split(":")[0];
      return name === config.model || name.startsWith(`${config.model}:`) || shortName === config.model;
    });

    return { ...base, models, reachable: true, modelAvailable };
  } catch {
    return { ...base, reachable: false, modelAvailable: false };
  }
}

export async function chatJson<T>(options: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ data: T; model: string; raw: string }> {
  const config = getAiConfig();
  if (!config.enabled) {
    throw new AiError("disabled", "Local AI is disabled.");
  }

  let res: Response;
  try {
    res = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: options.system },
          { role: "user", content: options.user },
        ],
        stream: false,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 2_048,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiError(
        "timeout",
        `Local AI timed out after ${Math.round(config.timeoutMs / 1000)}s.`
      );
    }
    throw new AiError("unreachable", "Could not reach Ollama. Is it running on this machine?");
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiError(
      "http_error",
      `Local AI request failed (${res.status}). ${detail.slice(0, 180)}`.trim(),
      res.status
    );
  }

  const payload = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const data = parseJsonLoose<T>(raw);
  if (!data) {
    throw new AiError("bad_response", "Local AI returned a response that was not valid JSON.");
  }

  return { data, model: payload.model ?? config.model, raw };
}
