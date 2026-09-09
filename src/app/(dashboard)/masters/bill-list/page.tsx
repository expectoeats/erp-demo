import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connection";
import Bill from "@/lib/models/Bill";
import FinancialYear from "@/lib/models/FinancialYear";
import BillListClient from "./bill-list-client";

export const dynamic = "force-dynamic";

export default async function BillListPageServer() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialData: any[] = [];
  let initialTotal = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialStats: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialFinancialYears: any[] = [];

  try {
    await connectDB();

    const listQuery: Record<string, unknown> = { status: "paid" };
    const [dataRaw, total, [statsRaw], fysRaw] = await Promise.all([
      Bill.find(listQuery)
        .populate("customerId", "customerId name mobile")
        .populate("unitId", "unitCode")
        .sort({ createdAt: -1 })
        .skip(0)
        .limit(20)
        .lean(),
      Bill.countDocuments(listQuery),
      Bill.aggregate([
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
      ]),
      FinancialYear.find()
        .select("name startDate endDate isActive isClosed")
        .sort({ startDate: -1 })
        .lean(),
    ]);

    initialData = JSON.parse(JSON.stringify(dataRaw));
    initialTotal = total;
    initialStats = statsRaw ?? {
      totalBills: 0,
      unpaidCount: 0,
      partiallyPaidCount: 0,
      paidCount: 0,
      overdueCount: 0,
      cancelledCount: 0,
      totalAmount: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    };
    initialFinancialYears = JSON.parse(JSON.stringify(fysRaw));
  } catch {
    // fallbacks already set above
  }

  return (
    <BillListClient
      initialData={initialData}
      initialTotal={initialTotal}
      initialStats={initialStats}
      initialFinancialYears={initialFinancialYears}
    />
  );
}
