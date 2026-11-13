import { NextResponse } from "next/server";
import { deleteAnalyses, listAnalyses } from "@/lib/db";
import { getOrCreateUserId } from "@/lib/session";


export async function GET() {
  const { userId } = await getOrCreateUserId();
  return NextResponse.json({ analyses: listAnalyses(userId, 10) });
}

export async function DELETE() {
  const { userId } = await getOrCreateUserId();
  const deleted = deleteAnalyses(userId);
  return NextResponse.json({ ok: true, deleted });
}
