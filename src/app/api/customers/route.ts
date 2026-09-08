import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Customer from "@/lib/models/Customer";
import OrgSettings from "@/lib/models/OrgSettings";
import { getNextSequence } from "@/lib/services/counter.service";
import {
  generatePastBills,
  getActiveFYBounds,
  validateBillingStartDate,
} from "@/lib/services/bill-generation.service";
import { z } from "zod";

const serviceItemSchema = z.object({
  type: z.string().min(1),
  rate: z.number().default(0),
  units: z.number().default(1),
  calculationMode: z.enum(["reading", "direct"]).optional(),
  initialReading: z.number().optional(),
  currentReading: z.number().optional(),
  description: z.string().optional(),
  isTaxable: z.boolean().default(true),
  gstRate: z.number().default(18),
});

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(10, "Valid mobile required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  orgId: z.string().optional().or(z.literal("")),
  billingLocationId: z.string().optional().or(z.literal("")),
  billingType: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  billingStartDate: z.string().optional().or(z.literal("")),
  services: z.array(serviceItemSchema).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

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

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20") || 20));
  const skip = (page - 1) * limit;

  // Escaped anchored regex for index-friendly prefix search + fallback contains
  const esc = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query = search
    ? {
        $or: [
          { name: { $regex: esc, $options: "i" } },
          { mobile: { $regex: esc, $options: "i" } },
          { customerId: { $regex: esc, $options: "i" } },
          { email: { $regex: esc, $options: "i" } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    Customer.find(query)
      .select("customerId name mobile email isActive orgId billingType billingStartDate nextBillingDate billingLocationId createdAt")
      .populate("orgId", "companyName orgCode")
      .populate("billingLocationId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .hint(search ? undefined : { createdAt: -1 }),
    Customer.countDocuments(query),
  ]);

  const res = NextResponse.json({ data, total, page, limit });
  // 0.2s target: allow CDN / browser to cache for 5s, stale-while-revalidate 30s
  res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
  return res;
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const d = parsed.data;
  const billingType = d.billingType || "monthly";

  // ── Active FY ──────────────────────────────────────────────────────────────
  const fyBounds = await getActiveFYBounds();
  if (!fyBounds) {
    return NextResponse.json(
      { error: "No active financial year found. Please set an active financial year before adding clients." },
      { status: 422 },
    );
  }

  // ── billingStartDate: parse & validate ─────────────────────────────────────
  const startDate = d.billingStartDate ? new Date(d.billingStartDate) : new Date();

  if (d.billingStartDate) {
    const dateErr = validateBillingStartDate(
      d.billingStartDate,
      fyBounds.fyStart,
      fyBounds.fyEnd,
    );
    if (dateErr) {
      return NextResponse.json({ error: dateErr }, { status: 422 });
    }
  }

  // ── Build customer document ────────────────────────────────────────────────
  const seq        = await getNextSequence("customer");
  const customerId = `CUST-${String(seq).padStart(5, "0")}`;

  const nextBillingDate = calculateNextBillingDate(startDate, billingType);

  // Auto-link billing location from org when not provided
  let resolvedLocationId = d.billingLocationId || undefined;
  if (!resolvedLocationId && d.orgId) {
    const org = await OrgSettings.findById(d.orgId).lean();
    resolvedLocationId = org?.locationId ? org.locationId.toString() : undefined;
  }

  const customer = await Customer.create({
    ...d,
    orgId:             d.orgId             || undefined,
    billingLocationId: resolvedLocationId,
    billingStartDate:  startDate,
    billingType,
    nextBillingDate,
    customerId,
    createdBy: session!.user.id,
  });

  // ── Auto-generate all past monthly bills in one go ─────────────────────────
  // Only runs when services are configured; silently no-ops otherwise.
  let billsResult = { created: [] as { month: string; year: number; invoiceNumber: string }[], skipped: [] as unknown[], errors: [] as unknown[] };

  if (d.services && d.services.length > 0) {
    try {
      // Cast to ICustomer — customer was just created so all fields are present
      billsResult = await generatePastBills(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        customer as any,
        session!.user.id,
      );

      if (billsResult.errors.length > 0) {
        console.warn(
          `[customers POST] ${billsResult.errors.length} bill(s) failed to generate for ${customerId}:`,
          billsResult.errors,
        );
      }
    } catch (err) {
      // Bill generation failure MUST NOT roll back the customer save
      console.error("[customers POST] bulk bill generation threw:", err);
    }
  }

  return NextResponse.json(
    {
      data: customer,
      billsGenerated: billsResult.created,
      billsSkipped:   billsResult.skipped,
      billErrors:     billsResult.errors,
      message:
        billsResult.created.length > 0
          ? `Client created. ${billsResult.created.length} bill(s) auto-generated (${billsResult.created.map((b) => `${b.month} ${b.year}`).join(", ")}).`
          : "Client created successfully.",
    },
    { status: 201 },
  );
}
