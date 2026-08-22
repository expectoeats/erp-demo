import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Customer from "@/lib/models/Customer";
import Location from "@/lib/models/Location";
import SubLocation from "@/lib/models/SubLocation";
import Unit from "@/lib/models/Unit";
import Bill from "@/lib/models/Bill";

function calculateNextBillingDate(startDate: Date, frequency: string = "monthly"): Date {
  const d = new Date(startDate);
  if (frequency === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (frequency === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const [customer, units, bills] = await Promise.all([
    Customer.findById(id).populate("billingLocationId", "name locationId").lean(),
    Unit.find({ currentOwnerId: id })
      .populate("locationId", "name")
      .populate("subLocationId", "name")
      .lean(),
    Bill.find({ customerId: id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ data: { customer, units, recentBills: bills } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = { ...body };
  if (body.billingLocationId === "") {
    updateData.billingLocationId = null;
  }

  if (body.billingStartDate) {
    const startDate = new Date(body.billingStartDate);
    const freq = body.billingType || "monthly";
    updateData.billingStartDate = startDate;
    updateData.nextBillingDate = calculateNextBillingDate(startDate, freq);
  }

  const updated = await Customer.findByIdAndUpdate(id, updateData, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  await Customer.findByIdAndUpdate(id, { isActive: false });
  return NextResponse.json({ success: true });
}
