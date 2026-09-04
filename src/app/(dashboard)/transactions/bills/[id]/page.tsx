"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Printer,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Calendar,
  CreditCard,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BillItem {
  serviceName: string;
  serviceCode?: string;
  calculationType?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  isTaxable: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  notes?: string;
}

interface BillData {
  _id: string;
  invoiceNumber: string;
  customerId: {
    _id: string;
    name: string;
    customerId: string;
    mobile?: string;
    email?: string;
    address?: string;
    gstin?: string;
  };
  unitId?: {
    unitCode: string;
    unitId: string;
    area?: number;
    areaUnit?: string;
  };
  locationId?: {
    name: string;
    address?: string;
    gstin?: string;
  };
  billTypeId?: {
    name: string;
    prefix: string;
  };
  financialYearId?: {
    name: string;
  };
  invoiceDate: string;
  dueDate: string;
  billingMonth: string;
  billingYear: number;
  items: BillItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  totalGst: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: "unpaid" | "partially_paid" | "paid" | "overdue" | "cancelled";
  notes?: string;
  createdAt: string;
}

const statusVariants: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  unpaid: "warning",
  partially_paid: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "muted",
};

export default function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function loadBill() {
      try {
        const r = await fetch(`/api/bills/${id}`);
        const d = await r.json();
        if (!r.ok) {
          toast.error(d.error || "Failed to load bill");
          return;
        }
        setBill(d.data);
      } catch {
        toast.error("Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }
    loadBill();
  }, [id]);

  async function handleMarkPaid() {
    if (!bill) return;
    setUpdating(true);
    try {
      const r = await fetch(`/api/bills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          paidAmount: bill.grandTotal,
          outstandingAmount: 0,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to mark paid");
        return;
      }
      toast.success("Invoice marked as PAID");
      setBill((prev) =>
        prev
          ? {
              ...prev,
              status: "paid",
              paidAmount: prev.grandTotal,
              outstandingAmount: 0,
            }
          : null
      );
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdating(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    const shimmer = (w: string = "w-full", h: string = "h-3") => (
      <div className={`${h} ${w} bg-gradient-to-r from-slate-200/70 via-slate-200/50 to-slate-200/70 rounded relative overflow-hidden`}>
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>
    );
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between no-print gap-3">
          {shimmer("w-32", "h-8")}
          <div className="flex items-center gap-2.5">
            {shimmer("w-28", "h-8")}
            {shimmer("w-36", "h-8")}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-8 space-y-8 animate-in fade-in duration-500">
          <div className="flex items-start justify-between border-b-2 border-primary/30 pb-6">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-slate-100 border border-slate-200" />
              <div className="space-y-2">
                {shimmer("w-36", "h-5")}
                {shimmer("w-48", "h-3")}
              </div>
            </div>
            <div className="text-right space-y-2">
              {shimmer("w-28", "h-5")}
              {shimmer("w-24", "h-5")}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            {[0,1,2,3].map((i)=>(
              <div key={i} className="space-y-1.5">
                {shimmer("w-16", "h-2.5")}
                {shimmer("w-28", "h-4")}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[0,1].map((i)=>(
              <div key={i} className="space-y-2 p-4 rounded-lg border border-slate-200/80 bg-white">
                {shimmer("w-32", "h-3")}
                <div className="space-y-1.5 pt-2">
                  {shimmer("w-full", "h-3")}
                  {shimmer("w-5/6", "h-3")}
                  {shimmer("w-4/6", "h-3")}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3 border-t border-slate-100 pt-6">
            {shimmer("w-32", "h-4")}
            <div className="border rounded-lg overflow-hidden divide-y divide-slate-100">
              {[0,1,2,3].map((i)=>(
                <div key={i} className="p-3 flex items-center justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    {shimmer("w-2/5", "h-3.5")}
                    {shimmer("w-1/4", "h-2.5")}
                  </div>
                  <div className="space-y-1">
                    {shimmer("w-20", "h-3")}
                    {shimmer("w-16", "h-2.5")}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-56 ml-auto space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
            {[0,1,2].map((i)=>(
              <div key={i} className="flex justify-between items-center">
                {shimmer("w-16", "h-3")}
                {shimmer("w-20", "h-3")}
              </div>
            ))}
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between items-center pt-1">
              {shimmer("w-20", "h-4")}
              {shimmer("w-24", "h-5")}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Invoice Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">The requested bill does not exist.</p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/transactions/bills">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Action Bar (hidden in print) */}
      <div className="flex items-center justify-between no-print gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/transactions/bills">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Invoices
          </Link>
        </Button>

        <div className="flex items-center gap-2.5">
          {bill.status !== "paid" && bill.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              loading={updating}
              onClick={handleMarkPaid}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <CheckCircle className="h-4 w-4 mr-1.5 text-emerald-600" />
              Mark as Paid
            </Button>
          )}

          <Button size="sm" onClick={handlePrint} className="shadow-xs gap-1.5">
            <Printer className="h-4 w-4" /> Print / Save as PDF
          </Button>
        </div>
      </div>

      {/* Invoice Document Paper */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-8 text-slate-800 print:border-none print:shadow-none print:p-0">
        {/* Header Branding */}
        <div className="flex items-start justify-between border-b-2 border-primary pb-6 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
              <Image
                src="/logo.jpeg"
                alt="Logo"
                width={48}
                height={48}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                PropertyERP
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Billing & Property Management System
              </p>
            </div>
          </div>

          <div className="text-right">
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">
              Tax Invoice
            </h2>
            <div className="mt-1">
              <Badge
                variant={statusVariants[bill.status] ?? "secondary"}
                className="uppercase tracking-wider text-[11px] px-2.5 py-0.5"
              >
                {bill.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
        </div>

        {/* Invoice Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 mb-6 text-xs">
          <div>
            <span className="text-slate-400 font-medium uppercase block text-[10px]">
              Invoice Number
            </span>
            <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
              {bill.invoiceNumber}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium uppercase block text-[10px]">
              Invoice Date
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {formatDate(bill.invoiceDate)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium uppercase block text-[10px]">
              Due Date
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {formatDate(bill.dueDate)}
            </span>
          </div>

          <div>
            <span className="text-slate-400 font-medium uppercase block text-[10px]">
              Billing Period
            </span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {bill.billingMonth} {bill.billingYear}
            </span>
          </div>
        </div>

        {/* Bill To & Location Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8 text-xs">
          <div className="space-y-1.5 p-4 rounded-lg border border-slate-200/80 bg-white">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block border-b border-slate-100 pb-1">
              Billed To (Client Details):
            </span>
            <div className="font-bold text-slate-900 text-sm pt-1">
              {bill.customerId?.name || "-"}
            </div>
            <div className="text-slate-600 font-mono">
              ID: {bill.customerId?.customerId || "-"}
            </div>
            {bill.customerId?.mobile && (
              <div className="text-slate-600">Mobile: {bill.customerId.mobile}</div>
            )}
            {bill.customerId?.email && (
              <div className="text-slate-600">Email: {bill.customerId.email}</div>
            )}
            {bill.customerId?.gstin && (
              <div className="font-mono text-slate-600">
                GSTIN: <span className="font-semibold">{bill.customerId.gstin}</span>
              </div>
            )}
            {bill.customerId?.address && (
              <div className="text-slate-500 pt-0.5">{bill.customerId.address}</div>
            )}
          </div>

          <div className="space-y-1.5 p-4 rounded-lg border border-slate-200/80 bg-white">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block border-b border-slate-100 pb-1">
              Property & Billing Category:
            </span>
            {bill.locationId && (
              <div className="pt-1">
                <span className="text-slate-500">Location:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {bill.locationId.name}
                </span>
                {bill.locationId.gstin && (
                  <div className="font-mono text-[11px] text-slate-600 mt-0.5">
                    GSTIN: <span className="font-semibold">{bill.locationId.gstin}</span>
                  </div>
                )}
              </div>
            )}
            {bill.unitId && (
              <div>
                <span className="text-slate-500">Unit / Property:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {bill.unitId.unitCode} ({bill.unitId.unitId})
                </span>
              </div>
            )}
            {bill.billTypeId && (
              <div>
                <span className="text-slate-500">Bill Type:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {bill.billTypeId.name}
                </span>
              </div>
            )}
            {bill.financialYearId && (
              <div>
                <span className="text-slate-500">Financial Year:</span>{" "}
                <span className="font-semibold text-slate-800">
                  {bill.financialYearId.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {(() => {
          // --------- GST Slab Summary computation ---------
          type SlabKey = string;
          const slabMap = new Map<SlabKey, {
            taxable: number;
            cgst: number;
            sgst: number;
            igst: number;
            totalGst: number;
          }>();
          let linesTaxable = 0;
          let linesGst = 0;
          let exemptBase = 0;
          const sameState = !!(bill.locationId?.gstin && bill.customerId?.gstin
            ? bill.locationId.gstin.slice(0, 2) === bill.customerId.gstin.slice(0, 2)
            : true);

          for (const it of bill.items ?? []) {
            const amt = Number(it.amount) || 0;
            if (!it.isTaxable) {
              exemptBase += amt;
              continue;
            }
            linesTaxable += amt;
            const slab = String(it.gstRate ?? 0);
            const gstAmt = Number(it.gstAmount) || 0;
            linesGst += gstAmt;
            const bucket = slabMap.get(slab) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0 };
            bucket.taxable += amt;
            bucket.totalGst += gstAmt;
            if (sameState) {
              bucket.cgst += gstAmt / 2;
              bucket.sgst += gstAmt / 2;
            } else {
              bucket.igst += gstAmt;
            }
            slabMap.set(slab, bucket);
          }
          const slabs = Array.from(slabMap.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));

          const rupee = (n: number) => formatCurrency(parseFloat(n.toFixed(2)));

          return (
            <>
              {/* Itemized Services Table — Clean simplified layout */}
              <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 print:break-inside-avoid">
                <table className="w-full text-xs text-left border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: "36px" }} />
                    <col style={{ width: "auto" }} />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "75px" }} />
                    <col style={{ width: "95px" }} />
                    <col style={{ width: "65px" }} />
                    <col style={{ width: "90px" }} />
                    <col style={{ width: "105px" }} />
                  </colgroup>
                  <thead className="bg-slate-800 text-white uppercase tracking-wider text-[10.5px] font-bold">
                    <tr>
                      <th className="py-2.5 px-2.5 text-center">#</th>
                      <th className="py-2.5 px-3">Service Description</th>
                      <th className="py-2.5 px-3 text-right font-mono tabular-nums">Rate</th>
                      <th className="py-2.5 px-3 text-right font-mono tabular-nums">Qty</th>
                      <th className="py-2.5 px-3 text-right font-mono tabular-nums">Taxable Value</th>
                      <th className="py-2.5 px-3 text-right font-mono tabular-nums">GST %</th>
                      <th className="py-2.5 px-3 text-right font-mono tabular-nums">GST</th>
                      <th className="py-2.5 px-3 text-right font-mono tabular-nums">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(bill.items ?? []).map((item, idx) => {
                      const r = Number(item.gstRate) || 0;
                      const code =
                        (item.serviceCode || "").toUpperCase() ||
                        (item.serviceName || "").toUpperCase().slice(0, 4);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 print:hover:bg-white">
                          <td className="py-3 px-2.5 text-center text-slate-500 font-bold align-top">{idx + 1}</td>
                          <td className="py-3 px-3 align-top">
                            <div className="flex flex-wrap items-center gap-1 mb-0.5">
                              <span className="font-bold text-slate-800 capitalize">{item.serviceName}</span>
                              {code && (
                                <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-600">
                                  {code}
                                </span>
                              )}
                              {item.calculationType && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-100 text-slate-500 bg-white">
                                  {item.calculationType}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-[10.5px] text-slate-500 leading-snug whitespace-pre-wrap mt-0.5">
                                {item.notes}
                              </p>
                            )}
                            {item.isTaxable && r > 0 ? (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/70">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                                  GST @ {r}%
                                </span>
                              </div>
                            ) : (
                              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 bg-slate-50 border border-slate-200">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                  Exempt / Nil Rated
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap align-top text-slate-700">
                            {rupee(Number(item.rate))}/{item.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap align-top text-slate-700">
                            {item.quantity} <span className="text-slate-400 text-[10px]">{item.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap align-top font-medium text-slate-800">
                            {rupee(Number(item.amount))}
                          </td>
                          <td className="py-3 px-3 text-center align-top">
                            {item.isTaxable && r > 0 ? (
                              <span className="inline-flex items-center justify-center font-mono font-bold text-[11px] rounded px-1.5 py-0.5 min-w-[42px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {r}%
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono font-bold text-[11px]">0%</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                            {item.isTaxable && r > 0 ? (
                              <span className="font-mono tabular-nums font-bold text-emerald-700">
                                {rupee(Number(item.gstAmount))}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-[11px]">₹0.00</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-extrabold tabular-nums whitespace-nowrap align-top text-slate-900 text-[12px]">
                            {rupee(Number(item.totalAmount))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-800/20 bg-slate-50/80 font-semibold text-[11px]">
                    <tr>
                      <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider text-slate-700">
                        Total Line Items →
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 font-bold">
                        {rupee(linesTaxable + exemptBase)}
                      </td>
                      <td></td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800 font-bold">
                        {rupee(linesGst)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 font-extrabold">
                        {rupee((linesTaxable + exemptBase) + linesGst)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Calculations & Summary */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 text-xs">
                <div className="max-w-xs text-slate-500 space-y-3">
                  {bill.notes && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
                      <span className="font-semibold text-slate-700 block mb-0.5">
                        Notes / Terms:
                      </span>
                      {bill.notes}
                    </div>
                  )}
                  {/* GSTIN block for reference if available */}
                  {(bill.locationId?.gstin || bill.customerId?.gstin) && (
                    <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                      {bill.locationId?.gstin && (
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                          <p className="text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Supplier GSTIN</p>
                          <p className="font-mono font-bold text-slate-800">{bill.locationId.gstin}</p>
                        </div>
                      )}
                      {bill.customerId?.gstin && (
                        <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                          <p className="text-slate-500 uppercase tracking-wider font-semibold mb-0.5">Recipient GSTIN</p>
                          <p className="font-mono font-bold text-slate-800">{bill.customerId.gstin}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-80 border-2 border-slate-800/20 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-3.5 py-2 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <p className="text-[10.5px] uppercase tracking-widest font-bold text-white">Invoice Summary (₹)</p>
                  </div>
                  <div className="p-3.5 space-y-2 text-[11.5px]">
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-600 font-medium">Subtotal</span>
                      <span className="font-mono font-semibold tabular-nums text-slate-800">{rupee(bill.subtotal)}</span>
                    </div>

                    {bill.discount > 0 && (
                      <div className="flex justify-between items-center py-0.5 text-emerald-700">
                        <span className="font-medium">(-) Discount</span>
                        <span className="font-mono font-semibold tabular-nums">- {rupee(bill.discount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-0.5 border-t border-dashed border-slate-200 pt-2">
                      <span className="text-slate-700 font-semibold">Taxable Amount</span>
                      <span className="font-mono font-bold tabular-nums text-slate-900">{rupee(bill.taxableAmount)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5 px-2.5 rounded-md bg-emerald-50/60 border border-emerald-200/80">
                      <span className="font-bold uppercase tracking-wider text-[10.5px] text-emerald-900">GST</span>
                      <span className="font-mono font-extrabold tabular-nums text-emerald-800 text-[12px]">
                        {rupee(bill.totalGst || linesGst)}
                      </span>
                    </div>

                    {bill.otherCharges > 0 && (
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-slate-600 font-medium">Other Charges</span>
                        <span className="font-mono font-semibold tabular-nums">{rupee(bill.otherCharges)}</span>
                      </div>
                    )}

                    {bill.roundOff !== 0 && (
                      <div className="flex justify-between items-center py-0.5 text-slate-500 text-[11px]">
                        <span>Round Off</span>
                        <span className="font-mono tabular-nums">{rupee(bill.roundOff)}</span>
                      </div>
                    )}

                    <div className="h-px bg-slate-200 my-1.5" />

                    <div className="flex justify-between items-center text-sm py-1.5 px-2.5 rounded-md bg-slate-900 text-white shadow-md print:bg-white print:text-slate-900 print:border-2 print:border-slate-900">
                      <span className="font-extrabold uppercase tracking-widest text-[10.5px]">Grand Total</span>
                      <span className="font-mono font-black tabular-nums text-[15px]">
                        {rupee(bill.grandTotal)}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200 mt-1">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Amount Received:</span>
                        <span className="font-mono font-bold tabular-nums text-emerald-600">
                          {rupee(bill.paidAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Balance Due:</span>
                        <span className={`font-mono font-bold tabular-nums ${bill.status === "paid" || bill.outstandingAmount <= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {bill.status === "paid" ? rupee(0) : rupee(bill.outstandingAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Footer Authorization Block */}
        <div className="border-t border-slate-200 pt-6 mt-8 flex flex-col sm:flex-row justify-between items-end text-[11px] text-slate-500 gap-6 print:break-inside-avoid">
          <div className="space-y-1 max-w-md">
            <p className="font-semibold text-slate-700">Thank you for your business.</p>
            <p className="text-[10.5px]">
              This is a computer-generated tax invoice under the Goods &amp; Services Tax (GST) Act, 2017 and does not require a physical signature.
            </p>
            <p className="text-[10.5px] italic">
              All prices are stated in Indian Rupees (₹). E. &amp; O.E.
            </p>
          </div>
          <div className="flex gap-10 items-end">
            <div className="text-center w-44">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">
                Seal &amp; Stamp
              </div>
              <div className="border-2 border-dashed border-slate-300 h-14 mb-1 rounded bg-slate-50/60" />
            </div>
            <div className="text-center w-44">
              <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-medium">
                Authorized Signatory
              </div>
              <div className="border-b-2 border-dashed border-slate-400 h-16 mb-1" />
              <div className="mt-1 h-px w-28 mx-auto bg-slate-300" />
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-700 block mt-1">
                Signature &amp; Name
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
