import { PROJECTS, ROLES, SKILL_ALIASES, normalizeSkill, type RoleKey, type ProjectIdea } from "./skills";

export type AnalysisResult = {
  targetRole: { key: RoleKey; label: string } | null;
  extractedSkills: string[];
  requiredSkills: string[];
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: Array<ProjectIdea & { score: number; covers: string[] }>;
};

const KNOWN_SKILLS = Array.from(
  new Set([
    ...Object.values(ROLES).flatMap((r) => r.skills),
    ...PROJECTS.flatMap((p) => p.skills),
    ...Object.values(SKILL_ALIASES),
    ...Object.keys(SKILL_ALIASES),
  ].map(normalizeSkill))
);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s,\/|]+/)
    .map((t) => t.trim())
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
  const vocab = Array.from(new Set([...project.skills, ...Array.from(missingSkills), ...Array.from(userSkills)]));
  // weight missing required skills higher to prioritize gap-filling projects (simple ML-style scoring)
  const weights = vocab.map((s) => (missingSkills.has(s) ? 2 : 1));
  const userVec = vocab.map((s, i) => (userSkills.has(s) ? 1 * weights[i] : 0));
  const needVec = vocab.map((s, i) => (missingSkills.has(s) ? 1.5 * weights[i] : project.skills.includes(s) ? 0.5 : 0));
  const targetVec = vocab.map((_, i) => needVec[i]);
  const sim = cosineSimilarity(userVec.map((v, i) => v + targetVec[i] * 0.2), vocab.map((s, i) => (project.skills.includes(s) ? 1 * weights[i] : 0)));
  const covers = project.skills.filter((s) => missingSkills.has(s));
  const coverage = missingSkills.size ? covers.length / missingSkills.size : 0;
  const known = project.skills.filter((s) => userSkills.has(s)).length / Math.max(project.skills.length, 1);
  const score = Number((sim * 0.4 + coverage * 0.45 + known * 0.15).toFixed(4));
  return { score, covers };
}

export function analyze(input: { skillsText: string; targetRole?: string }): AnalysisResult {
  const extractedSkills = extractSkills(input.skillsText);
  const roleKey = (Object.keys(ROLES) as RoleKey[]).includes(input.targetRole as RoleKey)
    ? (input.targetRole as RoleKey)
    : null;
  const targetRole = roleKey ? { key: roleKey, label: ROLES[roleKey].label } : null;
  const requiredSkills = roleKey ? ROLES[roleKey].skills : [];
  const userSet = new Set(extractedSkills);
  const matchedSkills = requiredSkills.filter((s) => userSet.has(s));
  const missingSkills = requiredSkills.filter((s) => !userSet.has(s));
  const missingSet = new Set(missingSkills.length ? missingSkills : requiredSkills);

  const recommendations = PROJECTS.map((p) => ({ ...p, ...scoreProject(p, userSet, missingSet) }))
    .sort((a, b) => b.score - a.score || b.covers.length - a.covers.length)
    .slice(0, 5);

  return { targetRole, extractedSkills, requiredSkills, matchedSkills, missingSkills, recommendations };
}
