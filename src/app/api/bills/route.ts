import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Bill from "@/lib/models/Bill";
import BillType from "@/lib/models/BillType";
import FinancialYear from "@/lib/models/FinancialYear";
import Customer from "@/lib/models/Customer";
import { calculateBill } from "@/lib/billing-engine";
import { z } from "zod";

const OBJECTID_RE = /^[a-f\d]{24}$/i;

const serviceInputSchema = z.object({
  serviceId: z.string().optional(),   // plain strings like "electricity" are allowed; stripped before DB save
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
  billTypeId: z.string().optional().or(z.literal("")),
  financialYearId: z.string().optional().or(z.literal("")),
  customerId: z.string().min(1),
  unitId: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  subLocationId: z.string().optional().or(z.literal("")),
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
  const clientSearch = searchParams.get("clientSearch") ?? "";
  const customerId = searchParams.get("customerId");
  const unitId = searchParams.get("unitId");
  const status = searchParams.get("status");
  const financialYearId = searchParams.get("financialYearId");
  const billingMonth = searchParams.get("billingMonth");
  const billingYear = searchParams.get("billingYear");
  const lastReading = searchParams.get("lastReading");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  // Handle auto-populating previous meter reading
  if (lastReading === "true" && (customerId || unitId)) {
    const filter: Record<string, unknown> = { status: { $ne: "cancelled" } };
    if (customerId) filter.customerId = customerId;
    if (unitId) filter.unitId = unitId;

    const latestBill = await Bill.findOne(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .lean();

    let previousEndReading: number | null = null;
    let previousEndDate: string | null = null;

    if (latestBill && Array.isArray(latestBill.items)) {
      previousEndDate = latestBill.invoiceDate ? new Date(latestBill.invoiceDate).toISOString().split("T")[0] : null;
      const elecItem = latestBill.items.find(
        (it) =>
          it.serviceName?.toLowerCase().includes("elec") ||
          it.calculationType === "METER" ||
          it.unit?.toLowerCase() === "kwh"
      );
      if (elecItem) {
        // Try to match "Meter: 1200 -> 1350" or "Meter: 1200 → 1350" or "Meter Reading: 1350 - 1200"
        const arrowMatch = elecItem.notes?.match(/(?:->|→)\s*(\d+(?:\.\d+)?)/);
        const readingMatch = elecItem.notes?.match(/Meter Reading:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
        if (arrowMatch?.[1]) {
          previousEndReading = parseFloat(arrowMatch[1]);
        } else if (readingMatch?.[1]) {
          previousEndReading = parseFloat(readingMatch[1]);
        } else if (elecItem.quantity) {
          previousEndReading = elecItem.quantity;
        }
      }
    }

    return NextResponse.json({
      data: {
        previousEndReading,
        previousEndDate,
        latestBillId: latestBill?._id,
        invoiceNumber: latestBill?.invoiceNumber,
      },
    });
  }

  const query: Record<string, unknown> = {};
  if (search) query.invoiceNumber = new RegExp(search, "i");
  if (customerId) query.customerId = customerId;
  if (unitId) query.unitId = unitId;
  if (status) query.status = { $in: status.split(",") };
  if (financialYearId) query.financialYearId = financialYearId;
  if (billingMonth) query.billingMonth = billingMonth;
  if (billingYear) query.billingYear = parseInt(billingYear);

  if (clientSearch) {
    const matchingCustomers = await Customer.find({
      $or: [
        { name: new RegExp(clientSearch, "i") },
        { customerId: new RegExp(clientSearch, "i") },
        { mobile: new RegExp(clientSearch, "i") },
      ],
    }).select("_id").lean();

    const customerIds = matchingCustomers.map((c) => c._id);
    query.customerId = { $in: customerIds };
  }

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

  // Auto-lookup billType if not provided
  let billType = d.billTypeId
    ? await BillType.findByIdAndUpdate(d.billTypeId, { $inc: { lastNumber: 1 } }, { new: true })
    : await BillType.findOneAndUpdate({ isActive: true }, { $inc: { lastNumber: 1 } }, { new: true });

  if (!billType) {
    billType = await BillType.findOneAndUpdate({}, { $inc: { lastNumber: 1 } }, { new: true });
  }
  if (!billType) return NextResponse.json({ error: "No bill type configured" }, { status: 400 });

  // Auto-lookup financial year if not provided
  let fy = d.financialYearId
    ? await FinancialYear.findById(d.financialYearId)
    : await FinancialYear.findOne({ isActive: true });

  if (!fy) fy = await FinancialYear.findOne({});
  if (!fy) return NextResponse.json({ error: "Financial year not found" }, { status: 400 });

  const invoiceNumber = `${billType.prefix}/${fy.name}/${String(billType.lastNumber).padStart(6, "0")}`;

  // Calculate using billing engine — pass serviceId as-is (stripped later)
  const billing = calculateBill({
    services: d.services.map((s) => ({ ...s, serviceId: s.serviceId ?? "" })),
    discount: d.discount,
    otherCharges: d.otherCharges,
    applyRoundOff: d.applyRoundOff,
  });

  // Prevent duplicate billing for same customer / unit for the same month-year
  const dupFilter: Record<string, unknown> = {
    billingMonth: d.billingMonth,
    billingYear: d.billingYear,
    status: { $ne: "cancelled" },
  };
  if (d.unitId) dupFilter.unitId = d.unitId;
  else dupFilter.customerId = d.customerId;

  const duplicate = await Bill.findOne(dupFilter).lean();
  if (duplicate) {
    return NextResponse.json(
      {
        error: `A bill for ${d.billingMonth} ${d.billingYear} already exists for this client (${duplicate.invoiceNumber}). Generated bills are preserved and cannot be overwritten.`,
      },
      { status: 409 }
    );
  }

  try {
    // Strip serviceId when it's not a real ObjectId (e.g. "maintenance", "electricity")
    // to avoid Mongoose cast errors. The field is optional on the schema.
    const itemsWithSafeServiceId = billing.items.map((item) => ({
      ...item,
      serviceId: OBJECTID_RE.test(item.serviceId ?? "") ? item.serviceId : undefined,
    }));

    const bill = await Bill.create({
      invoiceNumber,
      billTypeId: billType._id,
      financialYearId: fy._id,
      customerId: d.customerId,
      unitId: d.unitId || undefined,
      locationId: d.locationId || undefined,
      subLocationId: d.subLocationId || undefined,
      invoiceDate: new Date(d.invoiceDate),
      dueDate: new Date(d.dueDate || new Date(d.invoiceDate).getTime() + 15 * 24 * 60 * 60 * 1000),
      billingMonth: d.billingMonth,
      billingYear: d.billingYear,
      ...billing,
      items: itemsWithSafeServiceId,
      outstandingAmount: billing.grandTotal,
      notes: d.notes,
      createdBy: session!.user.id,
    });
    return NextResponse.json({ data: bill }, { status: 201 });
  } catch (e: unknown) {
    // Duplicate key (race condition)
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return NextResponse.json(
        { error: `Duplicate bill detected for ${d.billingMonth} ${d.billingYear}. Generated bills are immutable — cancel the existing bill before re-billing this period.` },
        { status: 409 }
      );
    }
    // Mongoose validation error — return the message instead of crashing with empty body
    if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "ValidationError") {
      const ve = e as unknown as { message: string };
      return NextResponse.json({ error: `Validation error: ${ve.message}` }, { status: 422 });
    }
    console.error("[POST /api/bills] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error while creating bill." }, { status: 500 });
  }
}
