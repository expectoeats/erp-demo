import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import BillType from "@/lib/models/BillType";
import Bill from "@/lib/models/Bill";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  prefix: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  lastNumber: z.number().optional(),
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const billType = await BillType.findById(id).lean();
  if (!billType) return NextResponse.json({ error: "Bill type not found" }, { status: 404 });

  const billsCount = await Bill.countDocuments({ billTypeId: id });
  return NextResponse.json({ data: { ...billType, billsCount } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.code) {
    const existing = await BillType.findOne({
      code: parsed.data.code.toUpperCase(),
      _id: { $ne: id },
    });
    if (existing) {
      return NextResponse.json({ error: "Bill type code already in use" }, { status: 409 });
    }
    parsed.data.code = parsed.data.code.toUpperCase();
  }

  const updated = await BillType.findByIdAndUpdate(id, parsed.data, { new: true });
  if (!updated) return NextResponse.json({ error: "Bill type not found" }, { status: 404 });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;

  // Check if any bills are associated with this bill type
  const billsCount = await Bill.countDocuments({ billTypeId: id });
  if (billsCount > 0) {
    await BillType.findByIdAndUpdate(id, { isActive: false });
    return NextResponse.json({
      message: "Bill type has associated bills and was deactivated instead of deleted.",
      deactivated: true,
    });
  }

  await BillType.findByIdAndDelete(id);
  return NextResponse.json({ success: true, deleted: true });
}
