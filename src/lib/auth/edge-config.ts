import type { NextAuthConfig } from "next-auth";

// Edge-safe config — no DB calls, no bcrypt
// Used only in middleware for session checking
export const edgeAuthConfig: NextAuthConfig = {
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
