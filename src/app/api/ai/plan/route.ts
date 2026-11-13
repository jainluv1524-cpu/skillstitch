import { NextResponse } from "next/server";
import { explainPlan, roleFromJobDescription } from "@/lib/ai/analysis";
import { cacheGet, cacheKey, cacheSet } from "@/lib/ai/cache";
import { AiError } from "@/lib/ai/client";
import { getAiConfig } from "@/lib/ai/config";
import type { AiPlan } from "@/lib/ai/types";
import { analyze, type RoleProfile } from "@/lib/analyzer";

const MAX_INPUT_LENGTH = 20_000;
const MAX_JD_LENGTH = 8_000;

export async function POST(req: Request) {
  const config = getAiConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "Local AI is disabled. Set SKILLSTITCH_AI=on to enable it." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const skillsText = typeof body?.skillsText === "string" ? body.skillsText.trim() : "";
    const targetRole = typeof body?.targetRole === "string" ? body.targetRole : "fullstack";
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

    let roleProfile: RoleProfile | undefined;
    if (targetRole === "custom") {
      if (jobDescription.length < 40) {
        return NextResponse.json(
          { error: "Paste a longer job description so the role profile can be derived." },
          { status: 400 }
        );
      }
      const role = await roleFromJobDescription(jobDescription);
      roleProfile = { key: "custom", label: role.label, skills: role.skills };
    }

    const result = await analyze({ skillsText, targetRole, roleProfile, computeEmbeddings: false });

    const key = cacheKey({
      version: "plan-v1",
      model: config.model,
      skillsText,
      targetRole,
      jobDescription,
      role: roleProfile ?? null,
    });
    const cached = cacheGet<{ plan: AiPlan; model: string }>(key);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const { plan, model } = await explainPlan(result, skillsText);
    cacheSet(key, { plan, model });

    return NextResponse.json({ plan, model });
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
