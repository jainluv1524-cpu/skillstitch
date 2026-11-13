import { NextResponse } from "next/server";
import { extractSkillsWithAi, roleFromJobDescription } from "@/lib/ai/analysis";
import { AiError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import type { AiRunMeta } from "@/lib/ai/types";
import { analyze, extractSkills, type RoleProfile } from "@/lib/analyzer";
import { saveAnalysis } from "@/lib/db";
import { ROLES, type RoleKey } from "@/lib/skills";
import { getOrCreateUserId } from "@/lib/session";

const MAX_INPUT_LENGTH = 20_000;
const MAX_JD_LENGTH = 8_000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skillsText = typeof body?.skillsText === "string" ? body.skillsText.trim() : "";
    const rawRole = typeof body?.targetRole === "string" ? body.targetRole : "fullstack";
    const useAi = body?.useAi === true;
    const jobDescription =
      typeof body?.jobDescription === "string" ? body.jobDescription.trim() : "";

    if (!skillsText) {
      return NextResponse.json(
        { error: "Please provide your skills, resume text, or project experience." },
        { status: 400 }
      );
    }

    if (skillsText.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `Please keep your input under ${MAX_INPUT_LENGTH.toLocaleString()} characters.` },
        { status: 413 }
      );
    }

    if (jobDescription.length > MAX_JD_LENGTH) {
      return NextResponse.json(
        { error: `Please keep the job description under ${MAX_JD_LENGTH.toLocaleString()} characters.` },
        { status: 413 }
      );
    }

    const knownRole = (Object.keys(ROLES) as RoleKey[]).includes(rawRole as RoleKey);
    const targetRole = rawRole === "custom" ? "custom" : knownRole ? rawRole : "fullstack";
    const config = getAiConfig();

    let roleProfile: RoleProfile | undefined;
    const aiMeta: AiRunMeta = { requested: useAi || targetRole === "custom", notices: [] };

    if (targetRole === "custom") {
      if (jobDescription.length < 40) {
        return NextResponse.json(
          { error: "Paste a longer job description so a role profile can be derived." },
          { status: 400 }
        );
      }
      if (!config.enabled) {
        return NextResponse.json(
          { error: "Custom roles need local AI. Enable it with SKILLSTITCH_AI=on." },
          { status: 503 }
        );
      }
      try {
        const role = await roleFromJobDescription(jobDescription);
        roleProfile = { key: "custom", label: role.label, skills: role.skills };
        aiMeta.role = { used: true, model: role.model, label: role.label };
      } catch (error) {
        const message =
          error instanceof AiError && error.code === "unreachable"
            ? "Custom roles need Ollama running locally. Start it or pick a preset role."
            : "Could not derive a role profile from that job description. Try a clearer posting or a preset role.";
        return NextResponse.json({ error: message }, { status: 503 });
      }
    }

    let extraSkills: string[] = [];
    if (useAi && config.enabled) {
      try {
        const extraction = await extractSkillsWithAi(skillsText);
        const deterministic = new Set(extractSkills(skillsText));
        extraSkills = extraction.skills;
        aiMeta.extraction = {
          used: true,
          model: extraction.model,
          addedSkills: extraction.skills.filter((skill) => !deterministic.has(skill)),
        };
      } catch {
        aiMeta.extraction = { used: false };
        aiMeta.notices?.push(
          "Local AI was unavailable for skill extraction, so the rule-based extractor was used."
        );
      }
    } else if (useAi) {
      aiMeta.extraction = { used: false };
      aiMeta.notices?.push("Local AI is disabled, so the rule-based extractor was used.");
    }

    const result = analyze({ skillsText, targetRole, extraSkills, roleProfile });
    if (aiMeta.requested) {
      result.ai = aiMeta;
    }

    const { userId } = await getOrCreateUserId();
    const saved = saveAnalysis(userId, { skillsText, targetRole, result });

    return NextResponse.json({
      ...result,
      saved: { id: saved.id, createdAt: saved.createdAt },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
