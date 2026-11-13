//
// GitHub OAuth callback for SkillStitch (NextAuth.js)
//
// 1. Set env vars: GITHUB_ID, GITHUB_SECRET, NEXTAUTH_SECRET, NEXTAUTH_URL
// 2. Users visit /api/auth/signin or click "Sign in with GitHub"
// 3. After callback, a JWT session is created
// 4. getUserId() returns the user ID, or null for anonymous sessions
//
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AUTH_OPTIONS = {
  providers: [
    // eslint-disable-line @typescript-eslint/no-explicit-any
    GitHub({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }) as any,
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  } as any,
  callbacks: {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    async signIn(_1: any, _2: any, _3: any, _4: any, _5: any): Promise<boolean> {
      return true;
    },
    // eslint-disable-line @typescript-eslint/no-explicit-any
    async jwt(token: any, _user: any, _account: any, _profile: any, _email: any, _credentials: any): Promise<any> {
      if (_user) {
        ;(token as any).id = _user?.id as string;
        ;(token as any).name = _user?.name as string;
        ;(token as any).email = _user?.email as string;
        ;(token as any).image = _user?.image as string;
      }
      if (_profile && typeof _profile === "object") {
        ;(token as any).githubId = (_profile as any).id as string;
        ;(token as any).githubUsername = (_profile as any).username as string;
        ;(token as any).githubDisplayName = (_profile as any).displayName as string;
      }
      return token;
    },
    // eslint-disable-line @typescript-eslint/no-explicit-any
    async session(_session: any, token: any): Promise<any> {
      ;(token.user as any).id = token.id as string;
      ;(token.user as any).name = token.name as string;
      ;(token.user as any).email = token.email as string;
      ;(token.user as any).image = token.image as string;
      ;(token.user as any).githubId = token.githubId as string;
      ;(token.user as any).githubUsername = token.githubUsername as string;
      ;(token.user as any).githubDisplayName = token.githubDisplayName as string;
      return _session;
    },
  } as any,
  // Secret for JWT signing — set via NEXTAUTH_SECRET env var
  secret: process.env.NEXTAUTH_SECRET as string,
} as any;

// NextAuth.js handlers expected by the App Router
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = async (req: Request) => {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const { default: handler } = await import("next-auth");
  return handler(AUTH_OPTIONS)(req);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = async (req: Request) => {
  // eslint-disable-line @typescript-eslint/no-explicit-any
  const { default: handler } = await import("next-auth");
  return handler(AUTH_OPTIONS)(req);
};