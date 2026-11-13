import { getAiConfig } from "./config";
import type { AiStatus } from "./types";
import { KNOWN_SKILLS, extractSkills as deterministicExtractSkills, type AnalysisResult } from "../analyzer";
import { normalizeSkill } from "../skills";

/** Codes returned to the UI so we can show the right message. */
export type AiErrorCode =
  | "disabled"
  | "unreachable"
  | "timeout"
  | "http_error"
  | "bad_response";

/** Renderable error for the UI. */
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

/** Very lenient JSON extractor — handles ```json fences, leading prose, and trailing commas. */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  if (!text) return null;

  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) cleaned = fence[1].trim();

  // Try the full cleaned string, then the first {...} block, then the last {...} block.
  const candidates: string[] = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // continue to next candidate
    }
  }
  return null;
}

/** Base URL for the Ollama HTTP API, ensuring no trailing slash. */
export function ollamaBaseUrl(): string {
  const config = getAiConfig();
  return config.baseUrl.replace(/\/+$/, "");
}

/** Chat completions endpoint for the configured base URL. */
export function chatUrl(): string {
  const base = ollamaBaseUrl();
  return base.endsWith("/v1") ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/** Fetch the list of available models from Ollama and return their names. */
export async function listModels(): Promise<string[]> {
  const config = getAiConfig();
  if (!config.enabled) return [];

  try {
    const res = await fetch(`${config.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = (await res.json()) as { models?: Array<{ name?: string }> };
    return (payload.models ?? []).map((m) => String(m.name ?? "")).filter(Boolean);
  } catch {
    return [];
  }
}

/** Check whether a given model name is among the registered Ollama models. */
export function modelIsAvailable(modelName: string, registered: string[]): boolean {
  const normalized = modelName.split(":")[0];
  return (
    registered.some(
      (r) => r === modelName || r.startsWith(`${modelName}:`) || r.split(":")[0] === normalized
    ) || normalized === "llama" || normalized === "mistral"
  );
}

/** AI error utilities for the UI. */
export const AiErrors = {
  disabled: () => ({ code: "disabled", message: "Local AI is disabled. Set SKILLSTITCH_AI=on to enable." }),
  unreachable: () => ({ code: "unreachable", message: "Ollama is not running. Start it with `ollama serve`." }),
  timeout: (ms: number) => ({
    code: "timeout",
    message: `Local AI timed out after ${Math.round(ms / 1000)}s. Try a smaller model or increase OLLAMA_TIMEOUT_MS.`,
  }),
  http_error: (status: number, detail: string) => ({
    code: "http_error",
    message: `AI request failed (${status}). ${detail.slice(0, 200)}`,
  }),
  bad_response: () => ({ code: "bad_response", message: "AI returned a response that was not valid JSON." }),
};

/** Parse the JSON from a model's chat completion response, tolerating fences and prose. */
function parseJsonFromResponse(raw: string): unknown {
  return parseJsonLoose(raw);
}

/** Execute a chat completion against the local Ollama instance. */
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
    res = await fetch(chatUrl(), {
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

/**
 * Extract only taxonomy‑validated skills from an LLM response.
 * Falls back gracefully when the model outputs unknown tokens.
 */
export function sanitizeExtraction(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).skills as string[])
      : null;
  return list != null
    ? list
        .filter((item): item is string => typeof item === "string")
        .map((s) => normalizeSkill(String(s)))
        .filter((skill): skill is string => KNOWN_SKILLS.includes(skill))
    : [];
}

/** Fuzzy check: does the user's text contain evidence for a given skill? */
export function skillHasEvidence(skill: string, text: string): boolean {
  const token = normalizeSkill(skill).toLowerCase();
  const lower = text.toLowerCase();
  // exact match or substring after word boundaries
  return (
    lower.includes(` ${token} `) ||
    lower.startsWith(`${token} `) ||
    lower.endsWith(` ${token}`) ||
    lower === token
  );
}

/**
 * Convenience: run the deterministic extractor first, then enrich with AI if available.
 * Returns the merged skill list, the model name (if AI was used), and whether AI added new skills.
 */
export async function extractSkillsWithFallback(
  text: string
): Promise<{ skills: string[]; model?: string; aiEnriched: boolean }> {
  const deterministic = deterministicExtractSkills(text);
  let aiSkills: string[] = [];
  let model: string | undefined;
  let aiEnriched = false;

  // Quick check: if the deterministic extractor already found many skills, skip AI.
  if (deterministic.length >= 5) {
    return { skills: deterministic, aiEnriched: false };
  }

  // Otherwise, try a single‑shot AI enrichment (max 1 request).
  try {
    const { data, model: m } = await chatJson<{ skills: string[] }>({
      system:
        'Extract skills from the user text. Include ONLY skills from the ALLOWED list. Return JSON exactly like {"skills":["react","sql"]}. No prose.',
      user: `ALLOWED_SKILLS: ${KNOWN_SKILLS.join(", ")}\n\nTEXT:\n"""\n${text}\n"""`,
      temperature: 0,
      maxTokens: 500,
    });
    model = m;
    if (data && data.skills) {
      aiSkills = sanitizeExtraction(data.skills);
      aiEnriched = true;
    }
  } catch {
    // AI enrichment failed silently — we still return the deterministic result.
  }

  // Merge: keep deterministic first, then add any AI‑only skills not already present.
  const merged = [...deterministic];
  const aiSet = new Set(aiSkills);
  for (const s of aiSkills) {
    if (!merged.includes(s)) merged.push(s);
  }
  return { skills: merged, model, aiEnriched };
}

/** Prompt‑builder for the 4‑week study plan. Returns a ready‑to‑send chat payload. */
export function buildPlanPrompt(
  result: AnalysisResult,
  skillsText: string,
  projectSummaries: Array<{ id: string; title: string; description: string; skills: string[] }>
): { system: string; user: string } {
  const projectSections = projectSummaries
    .map(
      (p, i) => `### Project ${i + 1}: ${p.title}\nDescription: ${p.description}\nSkills: ${p.skills.join(", ")}`
    )
    .join("\n");

  const system = `You are a pragmatic career mentor. Build a 4‑week study plan around the provided analysis and projects.
  Rules:
  - Exactly 4 weeks, week 1 first, week 4 last.
  - Each week has a theme (max 60 chars), a focus list (2‑4 skills from the ALLOWED_SKILLS taxonomy only), 2‑4 actions, and a deliverable (max 120 chars).
  - The summary must be under 400 characters.
  - The rationale for each project must be under 240 characters and reference the project ID exactly.
  - Use ONLY skills from ALLOWED_SKILLS: ${KNOWN_SKILLS.join(", ")}.
  - Return JSON exactly like:
    {
      "summary": "....",
      "weeks": [
        {"week":1,"theme":"...","focus":["sql","react"],"actions":["...","..."],"deliverable":"..."},
        {"week":2,"theme":"...","focus":["node"],"actions":["...","..."],"deliverable":"..."},
        {"week":3,"theme":"...","focus":["postgres"],"actions":["...","..."],"deliverable":"..."},
        {"week":4,"theme":"...","focus":["docker"],"actions":["...","..."],"deliverable":"..."}
      ],
      "rationale": [
        {"projectId":"auth-notes","why":"..."},
        {"projectId":"recipe-api","why":"..."}
      ]
    }
  - No markdown, no prose outside JSON.`.trim();

  const user = JSON.stringify({
    role: result.targetRole?.label ?? "Custom role",
    matchedSkills: result.matchedSkills,
    missingSkills: result.missingSkills,
    projects: projectSections,
    allowedSkills: KNOWN_SKILLS,
    profileExcerpt: skillsText.slice(0, 1_200),
  });

  return { system, user };
}

/** Check Ollama reachability and model availability. */
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