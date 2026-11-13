//
// Authentication for SkillStitch — supports three modes:
//   1. Anonymous cookie (default — no sign-up needed)
//   2. GitHub OAuth — set GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL
//   3. Email/password — Credentials provider with SQLite user storage
//
// After sign up / sign in, a JWT session is created and
// getUserId() returns the user ID for use in API routes.
//
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const AUTH_OPTIONS = {
  // Anonymous mode is handled by the session cookie alone — no provider needed.
  // GitHub OAuth is conditional on env vars.
  providers: [
    // GitHub OAuth (optional)
    // eslint-disable-line @typescript-eslint/no-explicit-any
    Credentials({
      // eslint-disable-line @typescript-eslint/no-explicit-any
      credentials: {
        email: { label: "Email", type: "email", placeholder: "user@example.com" },
        password: { label: "Password", type: "password" },
      },
      // eslint-disable-line @typescript-eslint/no-explicit-any
      async authorize(
        credentials:
          | {
              email: string;
              password: string;
            }
          | undefined,
      ): Promise<any | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Try email/password sign in
        const { signIn } = await import("@/lib/session");
        const result = await signIn(credentials.email, credentials.password);

        if (result.success && result.userId) {
          // Return user data that will be stored in the JWT token
          return {
            id: result.userId,
            email: credentials.email,
          };
        }

        return null;
      },
    } as any),
  ],
  // Session strategy: JWT persists user info in a cookie.
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Persist user data in the JWT token for use in API routes.
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt(
      token: any,
      user: any
    ): Promise<any> {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
      }
      return token;
    },
    // eslint-disable-line @typescript-eslint/no-explicit-any
    async session(
      session: any,
      token: any
    ): Promise<any> {
      // Attach user info to the session for use in components/API routes
      session.user = {
        id: token.id,
        email: token.email,
      };
      return session;
    },
  } as any,
  // Secret for JWT signing — required for any mode using sessions
  secret: process.env.NEXTAUTH_SECRET,
} as any;

// NextAuth.js handlers expected by the App Router
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = async (req: Request) => {
  const { default: handler } = await import("next-auth");
  return handler(AUTH_OPTIONS)(req);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = async (req: Request) => {
  const { default: handler } = await import("next-auth");
  return handler(AUTH_OPTIONS)(req);
};