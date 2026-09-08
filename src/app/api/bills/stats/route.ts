import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/auth/helpers";
import Bill from "@/lib/models/Bill";

let statsCache = new Map<string, { data: unknown; ts: number }>();
export async function GET(req: NextRequest) {
  const url = req.url;
  const cached = statsCache.get(url);
  if (cached && Date.now() - cached.ts < 10000) {
    const res = NextResponse.json(cached.data);
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
    res.headers.set("X-Cache", "HIT");
    return res;
  }
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const billingMonth = searchParams.get("billingMonth");
  const billingYear = searchParams.get("billingYear");
  const financialYearId = searchParams.get("financialYearId");

  const match: Record<string, unknown> = {};
  if (status) match.status = { $in: status.split(",") };
  if (billingMonth) match.billingMonth = billingMonth;
  if (billingYear) match.billingYear = parseInt(billingYear);
  if (financialYearId) match.financialYearId = financialYearId;

  const [stats] = await Bill.aggregate([
    ...(Object.keys(match).length > 0 ? [{ $match: match }] : []),
    {
      $group: {
        _id: null,
        totalBills: { $sum: 1 },
        unpaidCount: { $sum: { $cond: [{ $eq: ["$status", "unpaid"] }, 1, 0] } },
        partiallyPaidCount: { $sum: { $cond: [{ $eq: ["$status", "partially_paid"] }, 1, 0] } },
        paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        overdueCount: { $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] } },
        cancelledCount: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
        totalAmount: { $sum: "$grandTotal" },
        totalPaid: { $sum: "$paidAmount" },
        totalOutstanding: { $sum: "$outstandingAmount" },
      },
    },
  ]);

  const payload = {
    data: stats ?? {
      totalBills: 0,
      unpaidCount: 0,
      partiallyPaidCount: 0,
      paidCount: 0,
      overdueCount: 0,
      cancelledCount: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    },
  };
  statsCache.set(url, { data: payload, ts: Date.now() });
  // prune
  if (statsCache.size > 50) {
    const first = statsCache.keys().next().value as string;
    statsCache.delete(first);
  }
  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
  res.headers.set("X-Cache", "MISS");
  return res;
}
