import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import User from "@/lib/models/User";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["super_admin", "admin", "staff", "accountant", "viewer"]),
});

export async function GET() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();
  return NextResponse.json({ data: users });
}

export async function POST(req: NextRequest) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const exists = await User.findOne({ email: parsed.data.email });
  if (exists) return NextResponse.json({ error: "Email already exists" }, { status: 409 });

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const user = await User.create({ ...parsed.data, password: hashed });
  const { password: _, ...safeUser } = user.toObject();
  return NextResponse.json({ data: safeUser }, { status: 201 });
}
