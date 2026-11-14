//
// Analytics endpoint — receives anonymous event counts.
// This is a best-effort endpoint; no authentication required.
// Data is aggregated and stored in memory for the session lifetime.
//
import { NextResponse } from "next/server";
import type { AnalyticsEvent } from "@/lib/analytics";

 // In-memory store for this session (resets on restart)
 const analyticsStore: Record<AnalyticsEvent, number> = {
   analysis_started: 0,
   analysis_completed: 0,
   ai_toggle_on: 0,
   ai_toggle_off: 0,
   github_oauth_click: 0,
   role_selected: 0,
   project_clicked: 0,
   roadmap_exported: 0,
 };

 export async function POST(request: Request) {
   try {
     const body = await request.json();
     const { events } = body as { events: string[] };

     if (!Array.isArray(events)) {
       return NextResponse.json(
         { error: "Expected events array" },
         { status: 400 }
       );
     }

     // Count events
     events.forEach((event) => {
       if (analyticsStore[event as keyof typeof analyticsStore] !== undefined) {
         analyticsStore[event as keyof typeof analyticsStore] =
           (analyticsStore[event as keyof typeof analyticsStore] || 0) + 1;
       }
     });

     return NextResponse.json({
       status: "ok",
       stored: events.length,
       count: Object.values(analyticsStore).reduce(
         (sum, count) => sum + count,
         0
       ),
     });
   } catch (error) {
     return NextResponse.json(
       { error: "Invalid request format" },
       { status: 400 }
     );
   }
 }

 export async function GET() {
   return NextResponse.json({
     status: "ok",
     counts: analyticsStore,
   });
 }