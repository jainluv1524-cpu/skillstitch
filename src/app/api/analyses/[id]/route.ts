import { NextResponse } from "next/server";
import { deleteAnalysis } from "@/lib/db";
import { getUserId } from "@/lib/session";


export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "No session found." }, { status: 404 });
  }

  const { id } = await params;
  const deleted = deleteAnalysis(userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
