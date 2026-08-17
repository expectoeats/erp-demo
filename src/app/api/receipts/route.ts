import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/auth/helpers";
import Receipt from "@/lib/models/Receipt";

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

  const [data, total] = await Promise.all([
    Receipt.find(query)
      .populate("customerId", "name customerId")
      .populate("unitId", "unitCode")
      .populate("billId", "invoiceNumber grandTotal")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Receipt.countDocuments(query),
  ]);

  return NextResponse.json({ data, total, page, limit });
}
