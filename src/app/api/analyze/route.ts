import { NextResponse } from "next/server";
import { analyze } from "@/lib/analyzer";
import { saveAnalysis } from "@/lib/db";
import { getOrCreateUserId } from "@/lib/session";


const MAX_INPUT_LENGTH = 20_000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skillsText = typeof body?.skillsText === "string" ? body.skillsText.trim() : "";
    const targetRole = typeof body?.targetRole === "string" ? body.targetRole : "fullstack";

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

    const result = analyze({ skillsText, targetRole });
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
