"use client";

import React, { useEffect, useState, use } from "react";
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
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
                GSTIN: {bill.customerId.gstin}
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

        {/* Itemized Services Table */}
        <div className="mb-6 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-600 text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                <th className="py-2.5 px-3">Service Description</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-center">Units</th>
                <th className="py-2.5 px-3 text-right">Taxable</th>
                <th className="py-2.5 px-3 text-right">GST</th>
                <th className="py-2.5 px-3 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bill.items?.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 text-center text-slate-400 font-medium">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800 capitalize">
                      {item.serviceName}
                    </span>
                    {item.notes && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {item.notes}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatCurrency(item.rate)}
                  </td>
                  <td className="py-3 px-3 text-center font-mono">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-500">
                    {item.isTaxable ? `${item.gstRate}% (${formatCurrency(item.gstAmount)})` : "0%"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900">
                    {formatCurrency(item.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Calculations & Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8 text-xs">
          <div className="max-w-xs text-slate-500">
            {bill.notes && (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[11px]">
                <span className="font-semibold text-slate-700 block mb-0.5">
                  Notes / Terms:
                </span>
                {bill.notes}
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-2 border-t sm:border-t-0 pt-3 sm:pt-0">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-medium">{formatCurrency(bill.subtotal)}</span>
            </div>

            {bill.discount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span className="font-mono font-medium">- {formatCurrency(bill.discount)}</span>
              </div>
            )}

            {bill.totalGst > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Total GST:</span>
                <span className="font-mono font-medium">{formatCurrency(bill.totalGst)}</span>
              </div>
            )}

            {bill.otherCharges > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Other Charges:</span>
                <span className="font-mono font-medium">{formatCurrency(bill.otherCharges)}</span>
              </div>
            )}

            {bill.roundOff !== 0 && (
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Round Off:</span>
                <span className="font-mono">{formatCurrency(bill.roundOff)}</span>
              </div>
            )}

            <Separator className="my-1" />

            <div className="flex justify-between text-sm font-bold text-slate-900">
              <span>Grand Total:</span>
              <span className="font-mono text-primary">{formatCurrency(bill.grandTotal)}</span>
            </div>

            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-500">Amount Paid:</span>
              <span className="font-mono font-semibold text-emerald-600">
                {formatCurrency(bill.paidAmount)}
              </span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Balance Outstanding:</span>
              <span className="font-mono font-semibold text-rose-600">
                {formatCurrency(bill.outstandingAmount)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Authorization Block */}
        <div className="border-t border-slate-200 pt-6 mt-8 flex justify-between items-end text-[11px] text-slate-500">
          <div>
            <p>Thank you for your business.</p>
            <p className="mt-0.5">This is a system-generated invoice.</p>
          </div>
          <div className="text-center w-40">
            <div className="border-b border-dashed border-slate-400 h-10 mb-1" />
            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-600">
              Authorized Signature
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
