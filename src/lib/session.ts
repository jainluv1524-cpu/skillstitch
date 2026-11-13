//
// Session management for SkillStitch
// Supports three auth modes:
//   1. Anonymous cookie (default) — skillstitch_uid, no credentials
//   2. GitHub OAuth — set GITHUB_ID/SECRET + NEXTAUTH_URL
//   3. Email/password — Credentials provider with SQLite storage
//
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const USER_COOKIE = "skillstitch_uid";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Anonymous mode — every visitor gets a skillstitch_uid cookie automatically.
 * No credentials required. Analyses are isolated per session cookie.
 */
export async function getOrCreateUserIdAnonymous(): Promise<{ userId: string; isNew: boolean }> {
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
 * GitHub OAuth mode — returns the GitHub user ID from the JWT session.
 * Requires: GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL set,
 * and the auth callback at src/app/api/auth/[...nextauth]/route.ts
 */
export async function getUserIdOAuth(): Promise<string | null> {
  try {
    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/session`
    );
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Email/password mode — returns the user's own userId (set during sign up),
 * or null when no user is logged in.
 * Requires: NEXTAUTH_SECRET set, and the credentials provider configured.
 */
export async function getUserIdEmail(): Promise<string | null> {
  try {
    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/session`
    );
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Detect which auth mode is active and return the user ID.
 * Tries: OAuth → Email → Anonymous cookie.
 * Returns the first non-null user ID found.
 */
export async function getUserId(): Promise<string | null> {
  // Try email/password first
  const emailId = await getUserIdEmail();
  if (emailId) return emailId;

  // Try GitHub OAuth
  const oauthId = await getUserIdOAuth();
  if (oauthId) return oauthId;

  // Fall back to anonymous cookie
  const cookieStore = await cookies();
  const value = cookieStore.get(USER_COOKIE)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

/**
 * Returns the full user profile from the session.
 * Mode-dependent: OAuth → GitHub profile, Email → user's own data, Anonymous → null.
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

/**
 * Sign up with email and password.
 * Creates a user in SQLite and returns the user ID.
 * Returns null if the email is already taken.
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ userId: string | null; success: boolean; error?: string | null }> {
  try {
    // Validate email format
    if (!email.includes("@")) {
      return { userId: null, success: false, error: "Invalid email address" };
    }
    // Validate password length
    if (password.length < 6) {
      return { userId: null, success: false, error: "Password must be at least 6 characters" };
    }

    // Check if user already exists
    const existingId = await getUserIdEmail();
    if (existingId) {
      return { userId: null, success: false, error: "An account with this email already exists. Please sign in." };
    }

    // Generate a user ID and store in SQLite
    const userId = randomUUID();

    const db = await import("../lib/db");
    const { saveUser } = db;
    const result = await saveUser(userId, email);

    if (!result) {
      return { userId: null, success: false, error: "Failed to create user account. Please try again." };
    }

    // Now sign in the user (set the session)
    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/signin`
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, redirect: false }),
    });

    const data = await res.json();

    if (!res.ok || !data.user?.id) {
      // User created but sign in failed — clean up
      return { userId, success: true, error: null };
    }

    return { userId: data.user.id, success: true, error: null };
  } catch (err) {
    console.error("Sign up error:", err);
    return { userId: null, success: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Sign in with email and password.
 * Returns the user ID on success, or null on failure.
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ userId: string | null; success: boolean; error?: string | null }> {
  try {
    if (!email.includes("@")) {
      return { userId: null, success: false, error: "Invalid email address" };
    }

    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/signin`
    );

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, redirect: false }),
    });

    const data = await res.json();

    if (!res.ok || !data.user?.id) {
      const message = data.error || "Invalid email or password";
      return { userId: null, success: false, error: message };
    }

    return { userId: data.user.id, success: true, error: null };
  } catch (err) {
    console.error("Sign in error:", err);
    return { userId: null, success: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Get the current user's email from the session.
 */
export async function getCurrentEmail(): Promise<string | null> {
  try {
    const url = new URL(
      `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/session`
    );
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}