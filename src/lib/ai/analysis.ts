import { KNOWN_SKILLS, type AnalysisResult } from "../analyzer";
import { normalizeSkill } from "../skills";
import { AiError, chatJson } from "./client";
import type { AiPlan } from "./types";

const ALLOWED_SKILLS = new Set(KNOWN_SKILLS);
const ALLOWED_LIST = KNOWN_SKILLS.join(", ");
const PROMPT_VERSION = "v1";

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function asStringList(value: unknown, maxLength: number, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const text = asText(item, maxLength);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function asSkillList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const skill = normalizeSkill(asText(item, 40));
    if (ALLOWED_SKILLS.has(skill)) seen.add(skill);
    if (seen.size >= maxItems) break;
  }
  return Array.from(seen);
}

/** Only skills from the curated taxonomy survive, so the model cannot invent tech. */
export function sanitizeExtraction(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).skills
      : null;
  return asSkillList(list, 40);
}

export function sanitizeRole(raw: unknown): { label: string; skills: string[] } | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const label = asText(obj.label ?? obj.role ?? obj.title, 60);
  const skills = asSkillList(obj.skills ?? obj.requiredSkills, 16);
  if (!label || skills.length < 3) return null;
  return { label, skills };
}

export function sanitizePlan(raw: unknown, projectIds: string[]): AiPlan | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const summary = asText(obj.summary ?? obj.overview, 500);
  if (!summary) return null;

  const weeksRaw = Array.isArray(obj.weeks) ? obj.weeks : [];
  const weeks = weeksRaw
    .slice(0, 6)
    .map((item, index) => {
      const week = (item ?? {}) as Record<string, unknown>;
      return {
        week: Number.isFinite(Number(week.week)) ? Number(week.week) : index + 1,
        theme: asText(week.theme ?? week.title, 120),
        focus: asSkillList(week.focus ?? week.skills, 6),
        actions: asStringList(week.actions ?? week.tasks, 200, 4),
        deliverable: asText(week.deliverable ?? week.outcome, 200),
      };
    })
    .filter((week) => week.theme && week.actions.length > 0)
    .sort((a, b) => a.week - b.week);

  if (weeks.length < 3) return null;

  const rationaleRaw = Array.isArray(obj.rationale) ? obj.rationale : [];
  const seen = new Set<string>();
  const rationale: AiPlan["rationale"] = [];
  for (const item of rationaleRaw) {
    const entry = (item ?? {}) as Record<string, unknown>;
    const projectId = asText(entry.projectId ?? entry.id, 60);
    const why = asText(entry.why ?? entry.reason, 300);
    if (!projectId || !why) continue;
    if (!projectIds.includes(projectId) || seen.has(projectId)) continue;
    seen.add(projectId);
    rationale.push({ projectId, why });
    if (rationale.length >= 5) break;
  }

  return {
    summary,
    weeks: weeks.map((week, index) => ({ ...week, week: index + 1 })),
    rationale,
  };
}

export async function extractSkillsWithAi(
  text: string
): Promise<{ skills: string[]; model: string }> {
  const { data, model } = await chatJson<unknown>({
    system:
      'You extract skills from resumes and project notes. Use ONLY skills from ALLOWED_SKILLS. ' +
      'Include a skill only when the text shows real evidence for it, not because it is related. ' +
      'Return JSON exactly like {"skills":["react","sql"]}. No markdown, no commentary.',
    user: `ALLOWED_SKILLS: ${ALLOWED_LIST}\n\nTEXT:\n"""\n${truncate(text, 6_000)}\n"""`,
    temperature: 0,
    maxTokens: 600,
  });

  return { skills: sanitizeExtraction(data), model };
}

export async function roleFromJobDescription(
  jobDescription: string
): Promise<{ label: string; skills: string[]; model: string }> {
  const { data, model } = await chatJson<unknown>({
    system:
      'You turn job postings into a role profile. Use ONLY skills from ALLOWED_SKILLS. ' +
      'The label must be the job title from the posting, at most 60 characters. ' +
      'Pick 6 to 14 skills that the posting actually requires. ' +
      'Return JSON exactly like {"label":"Backend Developer","skills":["node","sql"]}. No markdown.',
    user: `ALLOWED_SKILLS: ${ALLOWED_LIST}\n\nJOB DESCRIPTION:\n"""\n${truncate(
      jobDescription,
      6_000
    )}\n"""`,
    temperature: 0,
    maxTokens: 700,
  });

  const role = sanitizeRole(data);
  if (!role) {
    throw new AiError(
      "bad_response",
      "Local AI could not derive a role profile from that job description."
    );
  }
  return { ...role, model };
}

export async function explainPlan(
  result: AnalysisResult,
  skillsText: string
): Promise<{ plan: AiPlan; model: string }> {
  const projects = result.recommendations.slice(0, 5).map((project) => ({
    id: project.id,
    title: project.title,
    description: project.description,
    skills: project.skills,
    covers: project.covers,
  }));
  const projectIds = projects.map((project) => project.id);

  const { data, model } = await chatJson<unknown>({
    system:
      'You are a pragmatic career mentor. Build a 4-week study plan around the provided projects. ' +
      'Only reference the provided project ids. Use only ALLOWED_SKILLS in focus lists. ' +
      'Keep the plan realistic for someone studying part-time. ' +
      'Return JSON exactly like {"summary":"...","weeks":[{"week":1,"theme":"...","focus":["sql"],"actions":["..."],"deliverable":"..."}],"rationale":[{"projectId":"auth-notes","why":"..."}]}. ' +
      'Exactly 4 weeks, 2-4 actions per week, summary under 400 characters, each why under 240 characters. No markdown.',
    user: JSON.stringify({
      role: result.targetRole?.label ?? "Custom role",
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      projects,
      allowedSkills: KNOWN_SKILLS,
      profileExcerpt: truncate(skillsText, 1_800),
    }),
    temperature: 0.3,
    maxTokens: 2_048,
  });

  const plan = sanitizePlan(data, projectIds);
  if (!plan) {
    throw new AiError("bad_response", "Local AI returned an incomplete study plan.");
  }
  return { plan, model };
}

export { PROMPT_VERSION };
