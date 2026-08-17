import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Bill from "@/lib/models/Bill";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const bill = await Bill.findById(id)
    .populate("customerId", "name customerId mobile email address gstin")
    .populate("unitId", "unitCode unitId area areaUnit")
    .populate("locationId", "name address gstin")
    .populate("subLocationId", "name")
    .populate("billTypeId", "name prefix")
    .populate("financialYearId", "name")
    .lean();

  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: bill });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  const body = await req.json();

  // If cancelling, record who and when
  if (body.status === "cancelled") {
    body.cancelledBy = session!.user.id;
    body.cancelledAt = new Date();
  }

  const updated = await Bill.findByIdAndUpdate(id, body, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
