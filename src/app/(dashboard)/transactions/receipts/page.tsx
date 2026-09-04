"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Receipt as ReceiptIcon,
  Plus,
  CheckCircle2,
  CreditCard,
  Building2,
  Calendar,
  Search,
  FileText,
  Printer,
  User,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/use-debounce";
import { useSearchParams } from "next/navigation";

interface CustomerRef {
  _id: string;
  name: string;
  customerId: string;
  mobile?: string;
}

interface BillRef {
  _id: string;
  invoiceNumber: string;
  grandTotal: number;
  paidAmount?: number;
  outstandingAmount?: number;
  status: string;
  billingMonth: string;
  billingYear: number;
  customerId?: CustomerRef;
}

interface Receipt {
  _id: string;
  receiptNumber: string;
  customerId: CustomerRef;
  billId: BillRef;
  amount: number;
  receiptDate: string;
  paymentMode: "cash" | "upi" | "bank_transfer" | "cheque" | "other";
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

const paymentModeLabels: Record<string, string> = {
  cash: "Cash",
  upi: "UPI / QR",
  bank_transfer: "Bank Transfer (NEFT/RTGS)",
  cheque: "Cheque",
  other: "Other",
};

export default function ReceiptsPage() {
  const searchParams = useSearchParams();
  const preselectedBillId = searchParams.get("billId");

  const [data, setData] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  // Unpaid bills for recording payments
  const [unpaidBills, setUnpaidBills] = useState<BillRef[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Receipt form state
  const [form, setForm] = useState({
    billId: "",
    amount: 0,
    paymentMode: "upi" as "cash" | "upi" | "bank_transfer" | "cheque" | "other",
    receiptDate: new Date().toISOString().split("T")[0],
    referenceNumber: "",
    notes: "",
  });

  // Selected bill object for display
  const selectedBill = useMemo(() => {
    return unpaidBills.find((b) => b._id === form.billId);
  }, [unpaidBills, form.billId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/receipts?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`
      );
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  const loadUnpaidBills = useCallback(async () => {
    try {
      const r = await fetch("/api/bills?status=unpaid,overdue,partially_paid&limit=100");
      const d = await r.json();
      setUnpaidBills(d.data ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadUnpaidBills();
  }, [loadUnpaidBills]);

  // Handle preselected bill from query param
  useEffect(() => {
    if (preselectedBillId && unpaidBills.length > 0) {
      const b = unpaidBills.find((bill) => bill._id === preselectedBillId);
      if (b) {
        const out = Number(b.outstandingAmount) || (Number(b.grandTotal) - Number(b.paidAmount || 0));
        setForm({
          billId: b._id,
          amount: out,
          paymentMode: "upi",
          receiptDate: new Date().toISOString().split("T")[0],
          referenceNumber: "",
          notes: "",
        });
        setModalOpen(true);
      }
    }
  }, [preselectedBillId, unpaidBills]);

  function openCreateModal(bill?: BillRef) {
    if (bill) {
      const out = Number(bill.outstandingAmount) || (Number(bill.grandTotal) - Number(bill.paidAmount || 0));
      setForm({
        billId: bill._id,
        amount: out,
        paymentMode: "upi",
        receiptDate: new Date().toISOString().split("T")[0],
        referenceNumber: "",
        notes: "",
      });
    } else {
      setForm({
        billId: "",
        amount: 0,
        paymentMode: "upi",
        receiptDate: new Date().toISOString().split("T")[0],
        referenceNumber: "",
        notes: "",
      });
    }
    setModalOpen(true);
  }

  function handleBillSelect(bId: string) {
    const b = unpaidBills.find((bill) => bill._id === bId);
    const out = b
      ? Number(b.outstandingAmount) || (Number(b.grandTotal) - Number(b.paidAmount || 0))
      : 0;

    setForm((prev) => ({
      ...prev,
      billId: bId,
      amount: out,
    }));
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!form.billId) {
      toast.error("Please select an unpaid bill");
      return;
    }
    if (!form.amount || form.amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to generate receipt");
        return;
      }

      toast.success(
        `Receipt generated: ${json.data.receiptNumber}! Bill updated to PAID.`
      );
      setModalOpen(false);
      load();
      loadUnpaidBills();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate total collection amount
  const totalCollected = useMemo(() => {
    return data.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  }, [data]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "receiptNumber",
      label: "Receipt No",
      className: "font-mono font-bold text-xs text-primary w-32",
    },
    {
      key: "billId",
      label: "Invoice",
      render: (v) => {
        const bill = v as BillRef;
        return bill ? (
          <Link
            href={`/transactions/bills/${bill._id}`}
            className="font-mono font-semibold text-xs text-slate-800 hover:text-primary hover:underline"
          >
            {bill.invoiceNumber}
          </Link>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        );
      },
    },
    {
      key: "customerId",
      label: "Client",
      render: (v) => {
        const cust = v as CustomerRef;
        return (
          <div>
            <div className="font-semibold text-slate-900 text-xs">{cust?.name || "-"}</div>
            {cust?.customerId && (
              <div className="text-[11px] text-slate-500 font-mono">{cust.customerId}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "amount",
      label: "Amount Paid",
      render: (v) => (
        <span className="font-mono font-bold text-emerald-600 text-xs">
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "receiptDate",
      label: "Payment Date",
      render: (v) => <span className="text-xs text-slate-700">{formatDate(v as string)}</span>,
    },
    {
      key: "paymentMode",
      label: "Mode",
      render: (v) => (
        <Badge variant="outline" className="capitalize text-[11px] bg-slate-50">
          {paymentModeLabels[String(v)] || String(v)}
        </Badge>
      ),
    },
    {
      key: "referenceNumber",
      label: "Ref / Txn ID",
      render: (v) => (
        <span className="font-mono text-xs text-slate-600">
          {String(v || "—")}
        </span>
      ),
    },
    {
      key: "_id",
      label: "",
      className: "w-20 text-right",
      render: (_, row) => {
        const receipt = row as unknown as Receipt;
        return (
          <div className="flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Print Receipt"
              onClick={() => {
                if (receipt.billId?._id) {
                  window.open(`/transactions/bills/${receipt.billId._id}`, "_blank");
                }
              }}
            >
              <Printer className="h-3.5 w-3.5 text-slate-600 hover:text-primary" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment Receipts"
        description="Generate payment receipts against unpaid bills and track collections"
      >
        <Button size="sm" onClick={() => openCreateModal()} className="shadow-xs gap-1.5">
          <Plus className="h-4 w-4" /> Record Payment / Receipt
        </Button>
      </PageHeader>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-4 rounded-xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-teal-50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Total Receipts
            </span>
            <div className="p-1.5 rounded-md bg-white border border-emerald-200 text-emerald-700">
              <ReceiptIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">{total}</div>
        </div>

        <div className="p-4 rounded-xl border border-blue-200 bg-linear-to-br from-blue-50 to-indigo-50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Recent Collections
            </span>
            <div className="p-1.5 rounded-md bg-white border border-blue-200 text-blue-700">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">
            {formatCurrency(totalCollected)}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Pending Unpaid Bills
            </span>
            <div className="p-1.5 rounded-md bg-white border border-amber-200 text-amber-700">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">
            {unpaidBills.length}
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <Card className="overflow-hidden border border-slate-200 shadow-xs bg-white">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data as unknown as Record<string, unknown>[]}
            loading={loading}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by receipt number..."
            emptyMessage="No receipts recorded yet. Click 'Record Payment' to issue a receipt."
          />
        </CardContent>
      </Card>

      {/* Record Payment / Generate Receipt Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                <ReceiptIcon className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Record Payment &amp; Generate Receipt
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Select an unpaid bill to record payment. Marking as paid automatically moves it to the Paid Bills list.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Bill Selector */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Select Unpaid Bill *
              </Label>
              <select
                value={form.billId}
                onChange={(e) => handleBillSelect(e.target.value)}
                className="mt-1.5 w-full h-10 border border-slate-200 rounded-lg px-3 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">-- Choose an Unpaid Invoice --</option>
                {unpaidBills.map((b) => {
                  const out = Number(b.outstandingAmount) || (Number(b.grandTotal) - Number(b.paidAmount || 0));
                  return (
                    <option key={b._id} value={b._id}>
                      {b.invoiceNumber} — {b.customerId?.name || "Client"} ({b.billingMonth} {b.billingYear}) • Due: {formatCurrency(out)}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Bill Overview Card */}
            {selectedBill && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Client:</span>
                  <span className="font-bold text-slate-900">{selectedBill.customerId?.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Period:</span>
                  <span className="font-medium text-slate-700">{selectedBill.billingMonth} {selectedBill.billingYear}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Total Invoice Amount:</span>
                  <span className="font-mono font-semibold text-slate-800">{formatCurrency(selectedBill.grandTotal)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-1">
                  <span className="font-semibold text-slate-700">Outstanding Balance:</span>
                  <span className="font-mono font-bold text-rose-600 text-sm">
                    {formatCurrency(Number(selectedBill.outstandingAmount) || (Number(selectedBill.grandTotal) - Number(selectedBill.paidAmount || 0)))}
                  </span>
                </div>
              </div>
            )}

            {/* Payment Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Amount Received (₹) *
                </Label>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  className="mt-1 h-9 text-xs font-mono font-bold"
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Payment Mode *
                </Label>
                <select
                  value={form.paymentMode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      paymentMode: e.target.value as "cash" | "upi" | "bank_transfer" | "cheque" | "other",
                    }))
                  }
                  className="mt-1 w-full h-9 border border-slate-200 rounded-lg px-3 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="upi">UPI / QR Payment</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Receipt Date *
                </Label>
                <Input
                  type="date"
                  className="mt-1 h-9 text-xs"
                  value={form.receiptDate}
                  onChange={(e) => setForm((f) => ({ ...f, receiptDate: e.target.value }))}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Ref / Transaction ID
                </Label>
                <Input
                  className="mt-1 h-9 text-xs font-mono"
                  placeholder="e.g. UPI Ref / Cheque No / UTR"
                  value={form.referenceNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, referenceNumber: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Notes / Remarks
              </Label>
              <Textarea
                rows={2}
                className="mt-1 text-xs resize-none"
                placeholder="Optional notes or receipt remarks..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submitting} className="gap-1.5 shadow-xs">
                <CheckCircle2 className="h-4 w-4" /> Save &amp; Mark as Paid
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
