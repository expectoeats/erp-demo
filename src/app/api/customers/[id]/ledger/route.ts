import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth } from "@/lib/auth/helpers";
import Customer from "@/lib/models/Customer";
import Bill from "@/lib/models/Bill";
import Receipt from "@/lib/models/Receipt";
import FinancialYear from "@/lib/models/FinancialYear";
import * as XLSX from "xlsx";

/**
 * GET /api/customers/:id/ledger?format=excel|json&financialYearId=...
 *
 * Returns a client's complete bill + payment ledger.
 * format=excel → streams an .xlsx file download
 * format=json  → returns JSON (default)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";
  const fyId   = searchParams.get("financialYearId");

  // Load customer
  const customer = await Customer.findById(id)
    .populate("orgId", "companyName")
    .lean();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Financial year filter
  const fyQuery: Record<string, unknown> = {};
  if (fyId) fyQuery._id = fyId;
  const financialYears = await FinancialYear.find(fyId ? { _id: fyId } : {})
    .sort({ startDate: -1 })
    .lean();

  // Bills for this customer (filtered by FY if given)
  const billQuery: Record<string, unknown> = { customerId: id };
  if (fyId) billQuery.financialYearId = fyId;

  const bills = await Bill.find(billQuery)
    .populate("financialYearId", "name")
    .sort({ invoiceDate: 1, createdAt: 1 })
    .lean();

  // Receipts for this customer (filtered by FY if given)
  const receiptQuery: Record<string, unknown> = { customerId: id };
  if (fyId) receiptQuery.financialYearId = fyId;

  const receipts = await Receipt.find(receiptQuery)
    .populate("billId", "invoiceNumber")
    .sort({ receiptDate: 1, createdAt: 1 })
    .lean();

  // ─── Build ledger rows ──────────────────────────────────────────────────
  type LedgerRow = {
    date: string;
    particular: string;
    type: string;
    invoiceNumber: string;
    billingPeriod: string;
    debit: number;
    credit: number;
    balance: number;
    status: string;
  };

  const rows: LedgerRow[] = [];
  let balance = 0;

  // Merge bills and receipts sorted by date
  type Event =
    | { kind: "bill"; date: Date; data: (typeof bills)[0] }
    | { kind: "receipt"; date: Date; data: (typeof receipts)[0] };

  const events: Event[] = [
    ...bills.map((b) => ({ kind: "bill" as const, date: new Date(b.invoiceDate), data: b })),
    ...receipts.map((r) => ({ kind: "receipt" as const, date: new Date(r.receiptDate), data: r })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const ev of events) {
    if (ev.kind === "bill") {
      const b = ev.data;
      if (b.status === "cancelled") continue; // cancelled bills don't affect ledger
      balance = parseFloat((balance + b.grandTotal).toFixed(2));
      const fyName = (b.financialYearId as { name?: string } | null)?.name ?? "";
      rows.push({
        date: new Date(b.invoiceDate).toLocaleDateString("en-IN"),
        particular: `Invoice Raised`,
        type: "Invoice",
        invoiceNumber: b.invoiceNumber,
        billingPeriod: `${b.billingMonth} ${b.billingYear}`,
        debit: b.grandTotal,
        credit: 0,
        balance,
        status: b.status.replace("_", " ").toUpperCase(),
      });
      void fyName;
    } else {
      const r = ev.data;
      balance = parseFloat((balance - r.amount).toFixed(2));
      const billInvoice = (r.billId as { invoiceNumber?: string } | null)?.invoiceNumber ?? "";
      rows.push({
        date: new Date(r.receiptDate).toLocaleDateString("en-IN"),
        particular: `Payment Received (${r.paymentMode.replace("_", " ").toUpperCase()})`,
        type: "Payment",
        invoiceNumber: billInvoice,
        billingPeriod: "",
        debit: 0,
        credit: r.amount,
        balance,
        status: "PAID",
      });
    }
  }

  // ─── JSON response ──────────────────────────────────────────────────────
  if (format !== "excel") {
    return NextResponse.json({
      customer: {
        name: customer.name,
        customerId: customer.customerId,
        mobile: customer.mobile,
        email: customer.email,
      },
      financialYears: financialYears.map((f) => ({ _id: f._id, name: f.name })),
      summary: {
        totalBilled: bills
          .filter((b) => b.status !== "cancelled")
          .reduce((s, b) => s + b.grandTotal, 0),
        totalPaid: receipts.reduce((s, r) => s + r.amount, 0),
        outstanding: balance,
        billCount: bills.filter((b) => b.status !== "cancelled").length,
        receiptCount: receipts.length,
      },
      ledger: rows,
    });
  }

  // ─── Excel response ─────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Ledger
  const wsData = [
    // Title row
    [`Client Ledger — ${customer.name} (${customer.customerId})`],
    [`Mobile: ${customer.mobile ?? ""}  |  Email: ${customer.email ?? ""}  |  Generated: ${new Date().toLocaleDateString("en-IN")}`],
    [], // blank row
    // Header
    ["Date", "Particular", "Type", "Invoice No", "Billing Period", "Debit (₹)", "Credit (₹)", "Balance (₹)", "Status"],
    // Data rows
    ...rows.map((r) => [
      r.date,
      r.particular,
      r.type,
      r.invoiceNumber,
      r.billingPeriod,
      r.debit || "",
      r.credit || "",
      r.balance,
      r.status,
    ]),
    [], // blank
    // Summary
    ["", "", "", "", "Total Billed →",
      bills.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.grandTotal, 0),
    ],
    ["", "", "", "", "Total Paid →", "", receipts.reduce((s, r) => s + r.amount, 0)],
    ["", "", "", "", "Outstanding →", "", "", balance],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 14 }, // Date
    { wch: 38 }, // Particular
    { wch: 12 }, // Type
    { wch: 22 }, // Invoice No
    { wch: 18 }, // Billing Period
    { wch: 14 }, // Debit
    { wch: 14 }, // Credit
    { wch: 14 }, // Balance
    { wch: 16 }, // Status
  ];

  // Merge title row across all columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Ledger");

  // Sheet 2 — Bills detail
  const billsWsData = [
    ["Invoice No", "Date", "Billing Period", "Financial Year", "Total (₹)", "Paid (₹)", "Outstanding (₹)", "Status", "Due Date"],
    ...bills.map((b) => [
      b.invoiceNumber,
      new Date(b.invoiceDate).toLocaleDateString("en-IN"),
      `${b.billingMonth} ${b.billingYear}`,
      (b.financialYearId as { name?: string } | null)?.name ?? "",
      b.grandTotal,
      b.paidAmount,
      b.outstandingAmount,
      b.status.replace("_", " ").toUpperCase(),
      b.dueDate ? new Date(b.dueDate).toLocaleDateString("en-IN") : "",
    ]),
  ];
  const billsWs = XLSX.utils.aoa_to_sheet(billsWsData);
  billsWs["!cols"] = [
    { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, billsWs, "Bills");

  // Sheet 3 — Payments detail
  const paymentsWsData = [
    ["Receipt No", "Date", "Invoice No", "Amount (₹)", "Payment Mode", "Reference"],
    ...receipts.map((r) => [
      r.receiptNumber,
      new Date(r.receiptDate).toLocaleDateString("en-IN"),
      (r.billId as { invoiceNumber?: string } | null)?.invoiceNumber ?? "",
      r.amount,
      r.paymentMode.replace("_", " ").toUpperCase(),
      r.referenceNumber ?? "",
    ]),
  ];
  const paymentsWs = XLSX.utils.aoa_to_sheet(paymentsWsData);
  paymentsWs["!cols"] = [
    { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, paymentsWs, "Payments");

  // Write to buffer
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const safeCustomerName = customer.name.replace(/[^a-zA-Z0-9]/g, "_");
  const fyLabel = financialYears[0]?.name ?? "ALL";
  const filename = `Ledger_${safeCustomerName}_${fyLabel}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
