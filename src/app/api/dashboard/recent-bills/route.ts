import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/auth/helpers";
import Bill from "@/lib/models/Bill";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();

  const bills = await Bill.find()
    .select("invoiceNumber grandTotal status invoiceDate customerId unitId")
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("customerId", "name")
    .populate("unitId", "unitCode")
    .lean();

  const data = bills.map((b) => ({
    _id: b._id,
    invoiceNumber: b.invoiceNumber,
    customerName: (b.customerId as unknown as { name: string })?.name ?? "",
    unitCode: (b.unitId as unknown as { unitCode: string })?.unitCode ?? "",
    grandTotal: b.grandTotal,
    status: b.status,
    invoiceDate: b.invoiceDate,
  }));

  const res = NextResponse.json({ data });
  res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=10");
  return res;
}
