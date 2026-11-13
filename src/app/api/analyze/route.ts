import { NextResponse } from "next/server";
import { analyze } from "@/lib/analyzer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skillsText = typeof body?.skillsText === "string" ? body.skillsText : "";
    const targetRole = typeof body?.targetRole === "string" ? body.targetRole : undefined;
    if (!skillsText.trim()) {
      return NextResponse.json({ error: "Please provide your skills, resume text, or project experience." }, { status: 400 });
    }
    const result = analyze({ skillsText, targetRole });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
}
