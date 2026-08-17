import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import FinancialYear from "@/lib/models/FinancialYear";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const { id } = await params;
  const body = await req.json();

  if (body.isActive) {
    await FinancialYear.updateMany({}, { isActive: false });
  }

  const updated = await FinancialYear.findByIdAndUpdate(id, body, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const { id } = await params;
  await FinancialYear.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
