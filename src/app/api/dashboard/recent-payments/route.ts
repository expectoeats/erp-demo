import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/auth/helpers";
import Payment from "@/lib/models/Payment";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const payments = await Payment.find()
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("customerId", "name")
    .lean();

  const data = payments.map((p) => ({
    _id: p._id,
    paymentId: p.paymentId,
    customerName: (p.customerId as unknown as { name: string })?.name ?? "",
    amount: p.amount,
    paymentMode: p.paymentMode,
    paymentDate: p.paymentDate,
  }));

  return NextResponse.json({ data });
}
