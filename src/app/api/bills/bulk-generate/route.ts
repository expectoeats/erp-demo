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

  // For dryRun: resolve which months already have bills and report without writing
  if (dryRun) {
    const years = [...new Set(pendingMonths.map((m) => m.year))];
    const existing = await Bill.find({
      customerId: customer._id,
      billingYear: { $in: years },
      status: { $ne: "cancelled" },
    })
      .select("billingMonth billingYear invoiceNumber")
      .lean();

    const existingSet = new Set(
      existing.map((b) => `${b.billingMonth}-${b.billingYear}`),
    );

    const wouldCreate = pendingMonths.filter(
      (m) => !existingSet.has(`${m.month}-${m.year}`),
    );
    const wouldSkip = pendingMonths
      .filter((m) => existingSet.has(`${m.month}-${m.year}`))
      .map((m) => ({
        month: m.month,
        year:  m.year,
        reason: "Bill already exists",
        existingInvoice: existing.find(
          (b) => b.billingMonth === m.month && b.billingYear === m.year,
        )?.invoiceNumber,
      }));

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
