//
// Session management for SkillStitch
// Supports anonymous cookie sessions (default) and GitHub OAuth (optional)
//
// 1. Anonymous mode (default): each visitor gets a skillstitch_uid cookie
//    - No credentials required
//    - Analyses are isolated per session cookie
//    - Cookie expires in 1 year
//
// 2. GitHub OAuth mode (optional): set env vars GITHUB_ID, GITHUB_SECRET,
//    NEXTAUTH_SECRET, NEXTAUTH_URL, and create the auth callback route at
//    src/app/api/auth/[...nextauth]/route.ts
//    - getUserId() returns the GitHub user ID
//    - After callback, a JWT session is created
//
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const USER_COOKIE = "skillstitch_uid";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Anonymous, cookie-backed identity for Phase 2–3.
 * A GitHub OAuth provider can replace this later without changing the
 * analyses API shape.
 */
export async function getOrCreateUserId(): Promise<{ userId: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(USER_COOKIE)?.value;

  if (existing && UUID_PATTERN.test(existing)) {
    return { userId: existing, isNew: false };
  }

  const userId = randomUUID();
  cookieStore.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return { userId, isNew: true };
}

/**
 * Returns the user ID from the session.
 * GitHub OAuth: returns the GitHub user ID.
 * Anonymous: returns the skillstitch_uid cookie value, or null.
 */
export async function getUserId(): Promise<string | null> {
  try {
    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/session`
    );
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.user?.id ?? null;
  } catch {
    // Fall back to the anonymous cookie
    const cookieStore = await cookies();
    const value = cookieStore.get(USER_COOKIE)?.value;
    return value && UUID_PATTERN.test(value) ? value : null;
  }
}

/**
 * Returns the full user profile from the session.
 * GitHub OAuth: returns the GitHub user profile data.
 * Anonymous: returns null.
 */
export async function getUserProfile() {
  try {
    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/session`
    );
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}