import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Unit from "@/lib/models/Unit";
import Bill from "@/lib/models/Bill";
import Payment from "@/lib/models/Payment";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const [unit, bills] = await Promise.all([
    Unit.findById(id)
      .populate("currentOwnerId", "name customerId mobile email")
      .populate("locationId", "name locationId")
      .populate("subLocationId", "name subLocationId")
      .populate("services", "name code calculationType isTaxable gstRate")
      .lean(),
    Bill.find({ unitId: id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: { unit, recentBills: bills } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const updated = await Unit.findByIdAndUpdate(id, body, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  await Unit.findByIdAndUpdate(id, { status: "inactive" });
  return NextResponse.json({ success: true });
}
