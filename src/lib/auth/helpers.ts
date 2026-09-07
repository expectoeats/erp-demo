import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/connection";
import { NextResponse } from "next/server";

export async function requireAuth() {
  // Kick off DB connection in parallel with session check — saves ~300-600ms on cold start
  const [session] = await Promise.all([auth(), connectDB().catch(() => null)]);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireRole(roles: string[]) {
  const { error, session } = await requireAuth();
  if (error) return { error, session: null };
  if (!roles.includes(session!.user.role)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}

export const ADMIN_ROLES = ["super_admin", "admin"];
export const FINANCE_ROLES = ["super_admin", "admin", "accountant"];
export const ALL_ROLES = ["super_admin", "admin", "accountant", "staff", "viewer"];
