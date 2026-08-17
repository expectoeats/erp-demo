import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, FINANCE_ROLES } from "@/lib/auth/helpers";
import Payment from "@/lib/models/Payment";
import Receipt from "@/lib/models/Receipt";
import Bill from "@/lib/models/Bill";
import LedgerEntry from "@/lib/models/LedgerEntry";
import FinancialYear from "@/lib/models/FinancialYear";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const schema = z.object({
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  billId: z.string().min(1),
  financialYearId: z.string().min(1),
  amount: z.number().positive("Amount must be positive"),
  paymentDate: z.string(),
  paymentMode: z.enum(["cash", "bank_transfer", "upi", "cheque", "other"]),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const billId = searchParams.get("billId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (customerId) query.customerId = customerId;
  if (billId) query.billId = billId;

  const [data, total] = await Promise.all([
    Payment.find(query)
      .populate("customerId", "name customerId")
      .populate("unitId", "unitCode")
      .populate("billId", "invoiceNumber grandTotal")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(query),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(FINANCE_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const d = parsed.data;

  // Fetch the bill
  const bill = await Bill.findById(d.billId);
  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  if (bill.status === "cancelled") return NextResponse.json({ error: "Cannot pay a cancelled bill" }, { status: 400 });

  const maxPayable = bill.outstandingAmount;
  if (d.amount > maxPayable) {
    return NextResponse.json(
      { error: `Payment amount (${d.amount}) exceeds outstanding (${maxPayable})` },
      { status: 400 }
    );
  }

  // Create payment
  const paySeq = await getNextSequence("payment");
  const paymentId = `PAY-${String(paySeq).padStart(6, "0")}`;

  const payment = await Payment.create({
    ...d,
    paymentId,
    paymentDate: new Date(d.paymentDate),
    receivedBy: session!.user.id,
    createdBy: session!.user.id,
  });

  // Update bill
  const newPaid = bill.paidAmount + d.amount;
  const newOutstanding = bill.grandTotal - newPaid;
  const newStatus = newOutstanding <= 0 ? "paid" : "partially_paid";

  await Bill.findByIdAndUpdate(d.billId, {
    paidAmount: newPaid,
    outstandingAmount: Math.max(0, newOutstanding),
    status: newStatus,
  });

  // Generate receipt
  const rcptSeq = await getNextSequence("receipt");
  const fy = await FinancialYear.findById(d.financialYearId);
  const receiptNumber = `RCT/${fy?.name ?? "YYYY-YY"}/${String(rcptSeq).padStart(6, "0")}`;

  const receipt = await Receipt.create({
    receiptNumber,
    paymentId: payment._id,
    billId: d.billId,
    customerId: d.customerId,
    unitId: d.unitId,
    financialYearId: d.financialYearId,
    amount: d.amount,
    receiptDate: new Date(d.paymentDate),
    paymentMode: d.paymentMode,
    referenceNumber: d.referenceNumber,
    notes: d.notes,
    receivedBy: session!.user.id,
    createdBy: session!.user.id,
  });

  // Ledger entry
  // First get current balance
  const lastEntry = await LedgerEntry.findOne({ customerId: d.customerId })
    .sort({ createdAt: -1 })
    .lean();
  const prevBalance = lastEntry?.balance ?? 0;
  const newBalance = prevBalance - d.amount;

  await LedgerEntry.create({
    customerId: d.customerId,
    unitId: d.unitId,
    financialYearId: d.financialYearId,
    date: new Date(d.paymentDate),
    particular: `Payment - ${receipt.receiptNumber}`,
    entryType: "payment",
    referenceId: payment._id,
    referenceModel: "Payment",
    referenceNumber: receipt.receiptNumber,
    debit: 0,
    credit: d.amount,
    balance: newBalance,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: { payment, receipt } }, { status: 201 });
}
