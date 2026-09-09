import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connection";
import Receipt from "@/lib/models/Receipt";
import Bill from "@/lib/models/Bill";
import ReceiptsClient from "./receipts-client";

export const dynamic = "force-dynamic";

export default async function ReceiptsPageServer() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialData: any[] = [];
  let initialTotal = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialUnpaidBills: any[] = [];

  try {
    await connectDB();

    const listQuery: Record<string, unknown> = {};
    const unpaidQuery: Record<string, unknown> = {
      status: { $in: ["unpaid", "overdue", "partially_paid"] },
    };

    const [receiptsRaw, total, unpaidRaw] = await Promise.all([
      Receipt.find(listQuery)
        .populate("customerId", "customerId name mobile")
        .populate({
          path: "billId",
          select:
            "invoiceNumber grandTotal paidAmount outstandingAmount status billingMonth billingYear customerId",
          populate: { path: "customerId", select: "customerId name mobile" },
        })
        .sort({ createdAt: -1 })
        .skip(0)
        .limit(20)
        .lean(),
      Receipt.countDocuments(listQuery),
      Bill.find(unpaidQuery)
        .select(
          "invoiceNumber grandTotal paidAmount outstandingAmount status billingMonth billingYear customerId"
        )
        .populate("customerId", "customerId name mobile")
        .sort({ billingYear: -1, createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    initialData = JSON.parse(JSON.stringify(receiptsRaw));
    initialTotal = total;
    initialUnpaidBills = JSON.parse(JSON.stringify(unpaidRaw));
  } catch {
    // fallbacks already set above
  }

  return (
    <ReceiptsClient
      initialData={initialData}
      initialTotal={initialTotal}
      initialUnpaidBills={initialUnpaidBills}
    />
  );
}
