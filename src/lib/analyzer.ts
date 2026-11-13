import { PROJECTS, ROLES, SKILL_ALIASES, normalizeSkill, type RoleKey, type ProjectIdea } from "./skills";
import type { AiRunMeta } from "./ai/types";

export type RoleProfile = {
  key: string;
  label: string;
  skills: string[];
};

export type AnalysisResult = {
  targetRole: { key: string; label: string } | null;
  extractedSkills: string[];
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: Array<ProjectIdea & { score: number; covers: string[] }>;
  ai?: AiRunMeta;
  /** Cosine similarity (0–1) between user's skillsText and the target role's required skills,
   *  computed via sentence-transformers. undefined when embeddings not computed. */
  embeddingSimilarity?: number;
};

export const KNOWN_SKILLS = Array.from(
  new Set([
    ...Object.values(ROLES).flatMap((r) => r.skills),
    ...PROJECTS.flatMap((p) => p.skills),
    ...Object.values(SKILL_ALIASES),
    ...Object.keys(SKILL_ALIASES),
  ].map(normalizeSkill))
);

export function isKnownSkill(value: string): boolean {
  return KNOWN_SKILLS.includes(normalizeSkill(value));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s,\/|]+/)
    .map((t) => t.trim().replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/g, ""))
    .filter(Boolean);
}

export function extractSkills(input: string): string[] {
  const tokens = tokenize(input);
  const found = new Set<string>();
  for (const raw of tokens) {
    const skill = normalizeSkill(raw);
    if (KNOWN_SKILLS.includes(skill)) found.add(skill);
  }
  // catch multi-word aliases present in raw text
  const lower = input.toLowerCase();
  for (const [alias, canonical] of Object.entries(SKILL_ALIASES)) {
    if (alias.includes(" ") && lower.includes(alias)) found.add(canonical);
  }
  return Array.from(found).sort();
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function scoreProject(project: ProjectIdea, userSkills: Set<string>, missingSkills: Set<string>) {
  const covers = project.skills.filter((s) => missingSkills.has(s));
  const coverage = missingSkills.size ? covers.length / missingSkills.size : 0;
  const known = project.skills.filter((s) => userSkills.has(s)).length / Math.max(project.skills.length, 1);
  const focus = covers.length / Math.max(project.skills.length, 1);

  // Cosine similarity between the user's skill vector and the project's skill vector.
  const vocab = Array.from(new Set([...project.skills, ...userSkills]));
  const userVec = vocab.map((s) => (userSkills.has(s) ? 1 : 0));
  const projectVec = vocab.map((s) => (project.skills.includes(s) ? 1 : 0));
  const similarity = cosineSimilarity(userVec, projectVec);

  const score = Number((coverage * 0.45 + similarity * 0.25 + known * 0.15 + focus * 0.15).toFixed(4));
  return { score, covers };
}

export async function analyze(input: {
  skillsText: string;
  targetRole?: string;
  extraSkills?: string[];
  roleProfile?: RoleProfile;
  computeEmbeddings?: boolean;
}): Promise<AnalysisResult & { embeddingSimilarity?: number }> {
  const extracted = new Set(extractSkills(input.skillsText));
  for (const raw of input.extraSkills ?? []) {
    const skill = normalizeSkill(raw);
    if (KNOWN_SKILLS.includes(skill)) extracted.add(skill);
  }
  const extractedSkills = Array.from(extracted).sort();

  const roleKey = (Object.keys(ROLES) as RoleKey[]).includes(input.targetRole as RoleKey)
    ? (input.targetRole as RoleKey)
    : null;

  const profile: RoleProfile | null =
    input.roleProfile ?? (roleKey ? { key: roleKey, label: ROLES[roleKey].label, skills: ROLES[roleKey].skills } : null);

  const targetRole = profile ? { key: profile.key, label: profile.label } : null;
  const requiredSkills = profile
    ? Array.from(new Set(profile.skills.map(normalizeSkill)))
    : [];
  const userSet = new Set(extractedSkills);
  const matchedSkills = requiredSkills.filter((s) => userSet.has(s));
  const missingSkills = requiredSkills.filter((s) => !userSet.has(s));
  const missingSet = new Set(missingSkills.length ? missingSkills : requiredSkills);

  const recommendations = PROJECTS.map((p) => ({ ...p, ...scoreProject(p, userSet, missingSet) }))
    .sort((a, b) => b.score - a.score || b.covers.length - a.covers.length)
    .slice(0, 5);

  // Optional: compute embedding-based similarity between user's skillsText and role requirements
  let embeddingSimilarity: number | undefined;
  if (input.computeEmbeddings) {
    const { augmentAnalysisWithEmbeddings } = await import("./embeddings");
    const resultWithEmbedding = await augmentAnalysisWithEmbeddings(
      { targetRole, extractedSkills, requiredSkills, matchedSkills, missingSkills, recommendations } as AnalysisResult,
      input.skillsText
    );
    embeddingSimilarity = resultWithEmbedding.embeddingSimilarity;
  }

  return { targetRole, extractedSkills, requiredSkills, matchedSkills, missingSkills, recommendations, embeddingSimilarity };
}