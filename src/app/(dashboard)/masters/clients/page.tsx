import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connection";
import Customer from "@/lib/models/Customer";
import ClientsClient from "./clients-client";

export const dynamic = "force-dynamic";

export default async function ClientsPageServer() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  try {
    await connectDB();
    const [data, total] = await Promise.all([
      Customer.find({})
        .select("customerId name mobile email isActive orgId billingType billingStartDate nextBillingDate billingLocationId createdAt")
        .populate("orgId", "companyName orgCode")
        .populate("billingLocationId", "name")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Customer.countDocuments({}),
    ]);
    const serialized = JSON.parse(JSON.stringify(data));
    return <ClientsClient initialData={serialized} initialTotal={total} />;
  } catch {
    // fallback to client fetch if DB fails
    return <ClientsClient initialData={[]} initialTotal={0} />;
  }
}
