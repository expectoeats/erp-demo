import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import FinancialYear from "@/lib/models/FinancialYear";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const years = await FinancialYear.find().sort({ startDate: -1 }).lean();
  return NextResponse.json({ data: years });
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

  const exists = await FinancialYear.findOne({ name: parsed.data.name });
  if (exists) {
    return NextResponse.json({ error: "Financial year already exists" }, { status: 409 });
  }

  // If new one is active, deactivate others
  if (parsed.data.isActive) {
    await FinancialYear.updateMany({}, { isActive: false });
  }

  const fy = await FinancialYear.create({
    ...parsed.data,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: fy }, { status: 201 });
}
