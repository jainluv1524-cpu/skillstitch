import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const USER_COOKIE = "skillstitch_uid";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Anonymous, cookie-backed identity for Phase 2.
 * A real auth provider (Auth.js, Clerk, etc.) can replace this later
 * without changing the analyses API shape.
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

export async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(USER_COOKIE)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}
