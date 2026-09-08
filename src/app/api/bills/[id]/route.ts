import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Bill from "@/lib/models/Bill";
import Location from "@/lib/models/Location";
import SubLocation from "@/lib/models/SubLocation";
import Customer from "@/lib/models/Customer";
import Unit from "@/lib/models/Unit";
import BillType from "@/lib/models/BillType";
import FinancialYear from "@/lib/models/FinancialYear";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const { id } = await params;

  if (!Location || !SubLocation || !Customer || !Unit || !BillType || !FinancialYear) {
    // Ensure models are registered
  }

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

/**
 * DELETE /api/bills/:id
 * Hard-deletes a bill that is unpaid/cancelled only (paid bills are protected).
 * Super-admin can force-delete any non-paid bill.
 * Invoice number gap is intentional — accounting integrity requires no renumbering.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const reason = searchParams.get("reason") ?? "Deleted by admin";

  const bill = await Bill.findById(id).lean();
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  // Paid bills cannot be deleted — only cancelled first
  if (bill.status === "paid" || bill.status === "partially_paid") {
    return NextResponse.json(
      { error: "Paid or partially paid bills cannot be deleted. Please cancel the bill first if needed." },
      { status: 403 }
    );
  }

  // Revert BillType sequence only if this was the last bill (best-effort)
  try {
    const BillTypeModel = (await import("@/lib/models/BillType")).default;
    const bt = await BillTypeModel.findById(bill.billTypeId).lean();
    if (bt) {
      // Extract bill number from invoiceNumber (e.g. INV/2026-27/000001 → 1)
      const parts = (bill.invoiceNumber ?? "").split("/");
      const num = parseInt(parts[parts.length - 1] ?? "0");
      if (!isNaN(num) && num === bt.lastNumber) {
        await BillTypeModel.findByIdAndUpdate(bt._id, { $inc: { lastNumber: -1 } });
      }
    }
  } catch (_e) {
    // Non-critical — gap in numbering is acceptable
  }

  await Bill.findByIdAndDelete(id);

  // Audit log
  console.info(
    `[Bill DELETE] id=${id} invoice=${bill.invoiceNumber} deletedBy=${session!.user.id} reason="${reason}"`
  );

  return NextResponse.json({ success: true, message: `Bill ${bill.invoiceNumber} deleted successfully.` });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  const body = await req.json();

  const existingBill = await Bill.findById(id);
  if (!existingBill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  // If the bill is paid, prevent modifying items and charges
  if (existingBill.status === "paid" && (body.items || body.grandTotal !== undefined)) {
    return NextResponse.json(
      { error: "This invoice is already paid and locked. Paid bills cannot be modified." },
      { status: 403 }
    );
  }

  const updateData: Record<string, unknown> = {};

  // Status & payment updates
  if (body.status !== undefined) updateData.status = body.status;
  if (body.paidAmount !== undefined) updateData.paidAmount = body.paidAmount;
  if (body.outstandingAmount !== undefined) updateData.outstandingAmount = body.outstandingAmount;
  if (body.notes !== undefined) updateData.notes = body.notes;

  // Manual editing on new / unpaid bills: allow editing items, extra charges (water, etc.), and recalculating
  if (existingBill.status === "unpaid" || existingBill.status === "overdue") {
    if (Array.isArray(body.items)) {
      updateData.items = body.items;
    }
    if (body.subtotal !== undefined) updateData.subtotal = body.subtotal;
    if (body.discount !== undefined) updateData.discount = body.discount;
    if (body.taxableAmount !== undefined) updateData.taxableAmount = body.taxableAmount;
    if (body.totalGst !== undefined) updateData.totalGst = body.totalGst;
    if (body.otherCharges !== undefined) updateData.otherCharges = body.otherCharges;
    if (body.roundOff !== undefined) updateData.roundOff = body.roundOff;
    if (body.grandTotal !== undefined) {
      updateData.grandTotal = body.grandTotal;
      // Recalculate outstanding if not explicitly given
      if (body.outstandingAmount === undefined) {
        const paid = body.paidAmount !== undefined ? body.paidAmount : existingBill.paidAmount;
        updateData.outstandingAmount = Math.max(0, body.grandTotal - paid);
      }
    }
  }

  // If cancelling, record who and when
  if (body.status === "cancelled") {
    updateData.cancelledBy = session!.user.id;
    updateData.cancelledAt = new Date();
    updateData.status = "cancelled";
    if (body.cancellationReason) updateData.cancellationReason = body.cancellationReason;
  }

  const updated = await Bill.findByIdAndUpdate(id, updateData, { new: true })
    .populate("customerId", "name customerId mobile email address gstin")
    .populate("unitId", "unitCode unitId area areaUnit")
    .populate("locationId", "name address gstin")
    .populate("subLocationId", "name")
    .populate("billTypeId", "name prefix")
    .populate("financialYearId", "name")
    .lean();

  return NextResponse.json({ data: updated });
}
