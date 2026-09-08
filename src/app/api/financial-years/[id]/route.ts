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

  if (body.isActive === true) {
    // Deactivate all others before setting this one active
    await FinancialYear.updateMany({}, { isActive: false });
  }

  // Explicitly pick allowed fields to prevent unintended overwrites
  const update: Record<string, unknown> = {};
  if (body.name      !== undefined) update.name      = body.name;
  if (body.startDate !== undefined) update.startDate = body.startDate;
  if (body.endDate   !== undefined) update.endDate   = body.endDate;
  if (body.isActive  !== undefined) update.isActive  = body.isActive;
  if (body.isClosed  !== undefined) update.isClosed  = body.isClosed;

  const updated = await FinancialYear.findByIdAndUpdate(id, { $set: update }, { new: true });
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
