import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connection";
import Bill from "@/lib/models/Bill";
import BillsClient from "./new-bills-client";

export const dynamic = "force-dynamic";

export default async function NewBillsPageServer() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let initialData: any[] = [];
  let initialTotal = 0;

  try {
    await connectDB();
    const defaultStatuses = ["unpaid", "overdue"];
    const query: Record<string, unknown> = { status: { $in: defaultStatuses } };

    const [data, total] = await Promise.all([
      Bill.find(query)
        .populate("customerId", "customerId name mobile")
        .populate("unitId", "unitCode")
        .sort({ createdAt: -1 })
        .skip(0)
        .limit(20)
        .lean(),
      Bill.countDocuments(query),
    ]);

    initialData = JSON.parse(JSON.stringify(data));
    initialTotal = total;
  } catch {
    // fallbacks already set above
  }

  return <BillsClient initialData={initialData} initialTotal={initialTotal} />;
}
