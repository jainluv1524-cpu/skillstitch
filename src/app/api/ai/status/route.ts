import { NextResponse } from "next/server";
import { checkAiStatus } from "@/lib/ai/client";

export async function GET() {
  const status = await checkAiStatus();
  return NextResponse.json(status);
}
