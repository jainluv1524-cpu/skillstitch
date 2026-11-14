// Analytics for SkillStitch — opt-in, anonymous usage tracking.
// Usage: trackEvent("analysis_started") etc.
// Set SKILLSTITCH_ANALYTICS=on in .env to enable.
// Data is sent to /api/analytics endpoint (best-effort, non-blocking).
export type AnalyticsEvent =
  | "analysis_started"
  | "analysis_completed"
  | "ai_toggle_on"
  | "ai_toggle_off"
  | "github_oauth_click"
  | "role_selected"
  | "project_clicked"
  | "roadmap_exported";

const ENabled = process.env.SKILLSTITCH_ANALYTICS === "on";

let pendingEvents: AnalyticsEvent[] = [];

/** Track an analytics event (fire-and-forget, non-blocking) */
export function trackEvent(event: AnalyticsEvent): void {
  if (!ENabled) return;

  pendingEvents.push(event);
  // Limit pending queue size
  if (pendingEvents.length > 50) {
    pendingEvents = pendingEvents.slice(-25);
  }

  // Try to send immediately (non-blocking)
  sendEvents();
}

/** Send all pending events to the API */
async function sendEvents(): Promise<void> {
  if (pendingEvents.length === 0) return;

  const events = [...pendingEvents];
  pendingEvents = [];

  try {
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events }),
      keepalive: true, // Don't block page unload
    });

    if (!response.ok) {
      // Re-queue events on failure
      pendingEvents = events;
    }
  } catch (error) {
    // Network error — re-queue events
    pendingEvents = events;
  }
}

/** Get current analytics status */
export function getAnalyticsStatus(): {
  enabled: boolean;
  pendingCount: number;
} {
  return {
    enabled: ENabled,
    pendingCount: pendingEvents.length,
  };
}