//
// Environment validation for SkillStitch.
// Checks required env vars at runtime and throws descriptive errors.
// Call this early in your app startup (e.g., in Next.js middleware or server entry point).
//

/** Required env vars — must be set in .env */
export const REQUIRED_ENVS = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"] as const;

/** Optional env vars with defaults */
export const OPTIONAL_ENVS = {
  SKILLSTITCH_DB_PATH: "./data/skillstitch.db",
  SKILLSTITCH_AI: "off" as const,
  OLLAMA_BASE_URL: "http://127.0.0.1:11434",
  OLLAMA_MODEL: "gemma4:26b",
  OLLAMA_TIMEOUT_MS: "240000",
  GITHUB_ID: undefined,
  GITHUB_SECRET: undefined,
};

/** Validate that required env vars are present. Throws if missing. */
export function validateEnv(): void {
  const missing: string[] = [];
  for (const key of REQUIRED_ENVS) {
    if (!process.env[key] || process.env[key].trim() === "") {
      missing.push(key);
    }
  }
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        `Set these in your .env file.`,
    );
  }
}

/** Get an optional env var with its default value. */
export function getEnv(key: string, defaultValue: string): string {
  const value = process.env[key];
  if (value !== undefined && value.trim() !== "") {
    return value;
  }
  return defaultValue;
}

/** Convenience: get all optional env vars at once. */
export function getAllOptionalEnvs() {
  return {
    skillstitchDbPath: getEnv("SKILLSTITCH_DB_PATH", "./data/skillstitch.db"),
    skillstitchAi: getEnv("SKILLSTITCH_AI", "off") as "on" | "off",
    ollamaBaseUrl: getEnv("OLLAMA_BASE_URL", "http://127.0.0.1:11434") as string,
    ollamaModel: getEnv("OLLAMA_MODEL", "gemma4:26b") as string,
    ollamaTimeoutMs: Number(getEnv("OLLAMA_TIMEOUT_MS", "240000")),
    githubId: process.env.GITHUB_ID as string | undefined,
    githubSecret: process.env.GITHUB_SECRET as string | undefined,
  };
}