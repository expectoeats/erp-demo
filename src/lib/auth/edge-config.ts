import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no DB calls, no bcrypt
// Used only in middleware for session checking
const fallbackSecret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "xK9mP2vQnR8sT5uW1yZ4bE7hJ0cL3fA6-demo-only-32chars!!";

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.warn(
    "[auth] AUTH_SECRET/NEXTAUTH_SECRET not set — using fallback secret for demo. Set AUTH_SECRET in Vercel env vars!"
  );
}

export const edgeAuthConfig: NextAuthConfig = {
  secret: fallbackSecret,
  trustHost: true,
  providers: [], // providers not needed in middleware
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
};
