import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import BillType from "@/lib/models/BillType";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  prefix: z.string().min(1),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const data = await BillType.find().sort({ name: 1 }).lean();
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const exists = await BillType.findOne({ code: parsed.data.code.toUpperCase() });
  if (exists) return NextResponse.json({ error: "Bill type code already exists" }, { status: 409 });

  const bt = await BillType.create({ ...parsed.data, createdBy: session!.user.id });
  return NextResponse.json({ data: bt }, { status: 201 });
}
