import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Bill from "@/lib/models/Bill";
import BillType from "@/lib/models/BillType";
import FinancialYear from "@/lib/models/FinancialYear";
import { calculateBill } from "@/lib/billing-engine";
import { z } from "zod";

const serviceInputSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  serviceCode: z.string(),
  calculationType: z.enum(["AREA_RATE", "QUANTITY_RATE", "FIXED", "MANUAL", "METER"]),
  quantity: z.number(),
  unit: z.string(),
  rate: z.number(),
  manualAmount: z.number().optional(),
  isTaxable: z.boolean(),
  gstRate: z.number(),
  notes: z.string().optional(),
});

const schema = z.object({
  billTypeId: z.string().min(1),
  financialYearId: z.string().min(1),
  customerId: z.string().min(1),
  unitId: z.string().min(1),
  locationId: z.string().min(1),
  subLocationId: z.string().min(1),
  invoiceDate: z.string(),
  dueDate: z.string().optional().or(z.literal("")),
  billingMonth: z.string(),
  billingYear: z.number(),
  services: z.array(serviceInputSchema).min(1, "At least one service required"),
  discount: z.number().optional(),
  otherCharges: z.number().optional(),
  applyRoundOff: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const customerId = searchParams.get("customerId");
  const unitId = searchParams.get("unitId");
  const status = searchParams.get("status");
  const financialYearId = searchParams.get("financialYearId");
  const billingMonth = searchParams.get("billingMonth");
  const billingYear = searchParams.get("billingYear");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (search) query.invoiceNumber = new RegExp(search, "i");
  if (customerId) query.customerId = customerId;
  if (unitId) query.unitId = unitId;
  if (status) query.status = { $in: status.split(",") };
  if (financialYearId) query.financialYearId = financialYearId;
  if (billingMonth) query.billingMonth = billingMonth;
  if (billingYear) query.billingYear = parseInt(billingYear);

  const [data, total] = await Promise.all([
    Bill.find(query)
      .populate("customerId", "name customerId mobile")
      .populate("unitId", "unitCode unitId")
      .populate("locationId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Bill.countDocuments(query),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole([...ADMIN_ROLES, "staff"]);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const d = parsed.data;

  // Generate invoice number atomically
  const billType = await BillType.findByIdAndUpdate(
    d.billTypeId,
    { $inc: { lastNumber: 1 } },
    { new: true }
  );
  if (!billType) return NextResponse.json({ error: "Bill type not found" }, { status: 400 });

  const fy = await FinancialYear.findById(d.financialYearId);
  if (!fy) return NextResponse.json({ error: "Financial year not found" }, { status: 400 });

  const invoiceNumber = `${billType.prefix}/${fy.name}/${String(billType.lastNumber).padStart(6, "0")}`;

  // Calculate using billing engine
  const billing = calculateBill({
    services: d.services,
    discount: d.discount,
    otherCharges: d.otherCharges,
    applyRoundOff: d.applyRoundOff,
  });

  // Prevent duplicate billing for same unit/month-year (historical retention)
  const duplicate = await Bill.findOne({ unitId: d.unitId, billingMonth: d.billingMonth, billingYear: d.billingYear }).lean();
  if (duplicate) {
    return NextResponse.json({ error: `A bill for ${d.billingMonth} ${d.billingYear} already exists for this unit. Generated bills are immutable and cannot be overwritten — please cancel the existing bill first if you need to re-bill this period.` }, { status: 409 });
  }

  try {
    const bill = await Bill.create({
      invoiceNumber,
      billTypeId: d.billTypeId,
      financialYearId: d.financialYearId,
      customerId: d.customerId,
      unitId: d.unitId,
      locationId: d.locationId,
      subLocationId: d.subLocationId,
      invoiceDate: new Date(d.invoiceDate),
      dueDate: new Date(d.dueDate || new Date(d.invoiceDate).getTime() + 15 * 24 * 60 * 60 * 1000),
      billingMonth: d.billingMonth,
      billingYear: d.billingYear,
      ...billing,
      outstandingAmount: billing.grandTotal,
      notes: d.notes,
      createdBy: session!.user.id,
    });
    return NextResponse.json({ data: bill }, { status: 201 });
  } catch (e: unknown) {
    // Handle race-condition duplicate key
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return NextResponse.json({ error: `Duplicate bill detected for ${d.billingMonth} ${d.billingYear}. Generated bills are immutable — cancel the existing bill before re-billing this period.` }, { status: 409 });
    }
    throw e;
  }
}
