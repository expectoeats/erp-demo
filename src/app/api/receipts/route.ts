import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Receipt from "@/lib/models/Receipt";
import Bill from "@/lib/models/Bill";
import Customer from "@/lib/models/Customer";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const receiptSchema = z.object({
  billId: z.string().min(1, "Bill is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  paymentMode: z.enum(["cash", "upi", "bank_transfer", "cheque", "other"]),
  receiptDate: z.string().min(1, "Receipt date is required"),
  referenceNumber: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const customerId = searchParams.get("customerId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (search) query.receiptNumber = new RegExp(search, "i");
  if (customerId) query.customerId = customerId;

  // Ensure models are registered for populate
  if (!Customer) { /* model registration check */ }

  const [data, total] = await Promise.all([
    Receipt.find(query)
      .populate("customerId", "name customerId mobile")
      .populate("billId", "invoiceNumber grandTotal status billingMonth billingYear")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Receipt.countDocuments(query),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = receiptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { billId, amount, paymentMode, receiptDate, referenceNumber, notes } = parsed.data;

  // Fetch the bill
  const bill = await Bill.findById(billId).lean();
  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }
  if (bill.status === "cancelled") {
    return NextResponse.json({ error: "Cannot record payment for a cancelled bill" }, { status: 400 });
  }
  if (bill.status === "paid") {
    return NextResponse.json({ error: "Bill is already fully paid" }, { status: 400 });
  }

  // Validate payment amount
  const outstanding = Number(bill.outstandingAmount) || Number(bill.grandTotal) - Number(bill.paidAmount);
  if (amount > outstanding + 0.01) {
    return NextResponse.json(
      { error: `Payment amount (₹${amount}) cannot exceed outstanding balance (₹${outstanding.toFixed(2)})` },
      { status: 400 }
    );
  }

  // Generate receipt number
  const seq = await getNextSequence("receipt");
  const receiptNumber = `RCT-${String(seq).padStart(6, "0")}`;

  // Calculate new paid/outstanding
  const newPaidAmount = Number(bill.paidAmount) + amount;
  const newOutstanding = Math.max(0, Number(bill.grandTotal) - newPaidAmount);
  const newStatus =
    newOutstanding <= 0.01 ? "paid" : "partially_paid";

  // Create receipt
  const receipt = await Receipt.create({
    receiptNumber,
    billId,
    customerId: bill.customerId,
    unitId: bill.unitId,
    amount,
    receiptDate: new Date(receiptDate),
    paymentMode,
    referenceNumber: referenceNumber || undefined,
    notes: notes || undefined,
    createdBy: session!.user.id,
  });

  // Update bill status atomically
  await Bill.findByIdAndUpdate(billId, {
    paidAmount: newPaidAmount,
    outstandingAmount: newOutstanding,
    status: newStatus,
  });

  const populated = await Receipt.findById(receipt._id)
    .populate("customerId", "name customerId mobile")
    .populate("billId", "invoiceNumber grandTotal billingMonth billingYear")
    .lean();

  return NextResponse.json({ data: populated }, { status: 201 });
}
