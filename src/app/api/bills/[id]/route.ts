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

  // Historical immutability: only status/paidAmount/outstandingAmount/cancellation fields can be patched
  // Reject attempts to overwrite items, amounts, billing period or customer/unit
  const disallowed = ["items", "subtotal", "discount", "taxableAmount", "totalGst", "otherCharges", "roundOff", "grandTotal", "customerId", "unitId", "billingMonth", "billingYear", "invoiceDate", "dueDate"] as const;
  for (const k of disallowed) {
    if (k in body) {
      return NextResponse.json({ error: "A generated bill's items, totals, and billing period cannot be modified. Only status, paidAmount, outstandingAmount, and cancellationReason may be updated." }, { status: 403 });
    }
  }
  const allowed = ["status", "paidAmount", "outstandingAmount", "cancellationReason"] as const;
  const sanitized: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) sanitized[k] = body[k];

  if (Object.keys(sanitized).length === 0 && body.status !== "cancelled") {
    return NextResponse.json({ error: "Past bills are immutable. Only status/payment updates allowed." }, { status: 403 });
  }

  // If cancelling, record who and when
  if (sanitized.status === "cancelled" || body.status === "cancelled") {
    sanitized.cancelledBy = session!.user.id;
    sanitized.cancelledAt = new Date();
    sanitized.status = "cancelled";
    if (body.cancellationReason) sanitized.cancellationReason = body.cancellationReason;
  }

  const updated = await Bill.findByIdAndUpdate(id, sanitized, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}
