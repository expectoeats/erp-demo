import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Customer from "@/lib/models/Customer";
import Bill from "@/lib/models/Bill";
import {
  generatePastBills,
  getActiveFYBounds,
  getPendingMonths,
} from "@/lib/services/bill-generation.service";

/**
 * POST /api/bills/bulk-generate
 *
 * On-demand catch-up bill generation for an existing client.
 * Uses the same shared service as POST /api/customers so behaviour is identical.
 *
 * Body: { customerId: string, dryRun?: boolean }
 */
export async function POST(req: NextRequest) {
  const { error, session } = await requireRole([...ADMIN_ROLES, "staff"]);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const { customerId, dryRun = false } = body as {
    customerId?: string;
    dryRun?: boolean;
  };

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  if (!customer.billingStartDate) {
    return NextResponse.json(
      { error: "Customer has no billing start date set" },
      { status: 422 },
    );
  }
  if (!customer.services?.length) {
    return NextResponse.json(
      { error: "Customer has no services configured" },
      { status: 422 },
    );
  }
  if (customer.billingType !== "monthly") {
    return NextResponse.json(
      {
        error: `Bulk generation supports monthly billing only. This customer is set to '${customer.billingType}'.`,
      },
      { status: 422 },
    );
  }

  const fyBounds = await getActiveFYBounds();
  if (!fyBounds) {
    return NextResponse.json(
      { error: "No active financial year found" },
      { status: 422 },
    );
  }

  const pendingMonths = getPendingMonths(
    new Date(customer.billingStartDate),
    fyBounds.fyStart,
    fyBounds.fyEnd,
  );

  if (pendingMonths.length === 0) {
    return NextResponse.json({
      message: "No pending months found. All bills are up to date.",
      created: [],
      skipped: [],
      errors:  [],
    });
  }

  // For dryRun: resolve which (month × service) combos already have bills
  if (dryRun) {
    const years = [...new Set(pendingMonths.map((m) => m.year))];
    const existing = await Bill.find({
      customerId: customer._id,
      billingYear: { $in: years },
      status: { $ne: "cancelled" },
    })
      .select("billingMonth billingYear invoiceNumber items")
      .lean();

    // Build set of Month-Year-ServiceName keys for per-service duplicate detection
    const existingSvcKeys = new Set<string>();
    const svcList = customer.services ?? [];

    for (const b of existing) {
      const itemNames = b.items?.length
        ? b.items.map((it) => (it.serviceName || "").toLowerCase())
        : svcList.map((s: { type?: string }) => (s.type || "service").toLowerCase());
      for (const sn of itemNames) {
        existingSvcKeys.add(`${b.billingMonth}-${b.billingYear}-${sn}`);
      }
    }

    interface DryEntry { month: string; year: number; service?: string; existingInvoice?: string; reason?: string; }
    const wouldCreate: DryEntry[] = [];
    const wouldSkip:   DryEntry[] = [];

    for (const m of pendingMonths) {
      for (const svc of svcList) {
        const svcName = (svc.type || "service").toLowerCase();
        const key = `${m.month}-${m.year}-${svcName}`;
        const matchedExisting = existing.find(
          (b) =>
            b.billingMonth === m.month &&
            b.billingYear === m.year &&
            (!b.items?.length ||
              b.items.some((it) => (it.serviceName || "").toLowerCase() === svcName)),
        );
        if (existingSvcKeys.has(key)) {
          wouldSkip.push({
            month:  m.month,
            year:   m.year,
            service: svcName,
            existingInvoice: matchedExisting?.invoiceNumber,
            reason: "Service bill already exists",
          });
        } else {
          wouldCreate.push({ month: m.month, year: m.year, service: svcName });
        }
      }
    }

    return NextResponse.json({
      dryRun:       true,
      wouldCreate,
      wouldSkip,
      totalPending: wouldCreate.length,
    });
  }

  // Real generation — delegate entirely to shared service
  const result = await generatePastBills(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customer as any,
    session!.user.id,
  );

  return NextResponse.json(
    {
      message: `Bulk generation complete. Created: ${result.created.length}, Skipped: ${result.skipped.length}, Errors: ${result.errors.length}.`,
      created: result.created,
      skipped: result.skipped,
      errors:  result.errors,
    },
    { status: result.errors.length > 0 && result.created.length === 0 ? 422 : 201 },
  );
}
