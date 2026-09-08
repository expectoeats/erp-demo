import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/auth/helpers";
import Customer from "@/lib/models/Customer";
import Unit from "@/lib/models/Unit";
import Bill from "@/lib/models/Bill";
import Payment from "@/lib/models/Payment";
import Receipt from "@/lib/models/Receipt";

// In-memory cache for 0.2s target — 10s TTL
let cache: { data: unknown; ts: number } | null = null;
const TTL = 10_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    const res = NextResponse.json(cache.data);
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
    res.headers.set("X-Cache", "HIT");
    return res;
  }
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [
    totalCustomers,
    totalUnits,
    activeUnits,
    vacantUnits,
    billingAgg,
    collectionAgg,
    outstandingAgg,
    overdueAgg,
    totalReceipts,
  ] = await Promise.all([
    Customer.countDocuments({ isActive: true }),
    Unit.countDocuments(),
    Unit.countDocuments({ status: "active" }),
    Unit.countDocuments({ status: "vacant" }),
    Bill.aggregate([
      { $match: { invoiceDate: { $gte: firstOfMonth, $lte: lastOfMonth } } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: firstOfMonth, $lte: lastOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Bill.aggregate([
      { $match: { status: { $in: ["unpaid", "partially_paid"] } } },
      { $group: { _id: null, total: { $sum: "$outstandingAmount" } } },
    ]),
    Bill.aggregate([
      { $match: { status: "overdue" } },
      { $group: { _id: null, total: { $sum: "$outstandingAmount" } } },
    ]),
    Receipt.countDocuments(),
  ]);

  const payload = {
    data: {
      totalCustomers,
      totalUnits,
      activeUnits,
      vacantUnits,
      currentMonthBilling: billingAgg[0]?.total ?? 0,
      currentMonthCollection: collectionAgg[0]?.total ?? 0,
      outstanding: outstandingAgg[0]?.total ?? 0,
      overdueAmount: overdueAgg[0]?.total ?? 0,
      totalReceipts,
    },
  };
  cache = { data: payload, ts: Date.now() };
  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
  res.headers.set("X-Cache", "MISS");
  return res;
}
