import { NextResponse } from "next/server";
import { deleteAnalyses, listAnalyses } from "@/lib/db";
import { getOrCreateUserIdAnonymous } from "@/lib/session";


export async function GET() {
  const { userId } = await getOrCreateUserIdAnonymous();
  return NextResponse.json({ analyses: listAnalyses(userId, 10) });
}

export async function DELETE() {
  const { userId } = await getOrCreateUserIdAnonymous();
  const deleted = deleteAnalyses(userId);
  return NextResponse.json({ ok: true, deleted });
}
