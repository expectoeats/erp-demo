"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface Payment {
  _id: string;
  paymentId: string;
  customerId: { name: string; customerId: string };
  unitId: { unitCode: string };
  billId: { invoiceNumber: string; grandTotal: number };
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
}

interface Customer { _id: string; name: string; customerId: string; }
interface Bill { _id: string; invoiceNumber: string; grandTotal: number; outstandingAmount: number; status: string; }

const payModes = ["cash", "bank_transfer", "upi", "cheque", "other"];

export default function PaymentsPage() {
  const [data, setData] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [financialYears, setFinancialYears] = useState<{ _id: string; name: string }[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const [form, setForm] = useState({
    customerId: "", unitId: "", billId: "", financialYearId: "",
    amount: "", paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "cash", referenceNumber: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/payments?page=${page}&limit=20`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/customers?limit=200").then((r) => r.json()).then((d) => setCustomers(d.data ?? []));
    fetch("/api/financial-years").then((r) => r.json()).then((d) => setFinancialYears(d.data ?? []));
  }, []);

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/bills?customerId=${form.customerId}&status=unpaid&limit=50`)
        .then((r) => r.json()).then((d) => {
          const unpaid = (d.data ?? []).filter((b: Bill) => ["unpaid", "partially_paid"].includes(b.status));
          setBills(unpaid);
        });
    }
  }, [form.customerId]);

  useEffect(() => {
    if (form.billId) {
      const b = bills.find((x) => x._id === form.billId);
      setSelectedBill(b ?? null);
      if (b) setForm((f) => ({ ...f, amount: String(b.outstandingAmount) }));
    }
  }, [form.billId, bills]);

  async function handleSave() {
    if (!form.customerId || !form.billId || !form.amount || !form.financialYearId) {
      toast.error("All required fields must be filled");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        unitId: selectedBill ? (bills.find((b) => b._id === form.billId) as unknown as { unitId?: string })?.unitId ?? form.unitId : form.unitId,
      };

      // Get unitId from bill
      const billRes = await fetch(`/api/bills/${form.billId}`);
      const billData = await billRes.json();
      const finalPayload = { ...payload, unitId: billData.data?.unitId?._id ?? form.unitId };

      const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalPayload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(`Payment recorded. Receipt: ${d.data.receipt.receiptNumber}`);
      setOpen(false);
      setForm({ customerId: "", unitId: "", billId: "", financialYearId: "", amount: "", paymentDate: new Date().toISOString().split("T")[0], paymentMode: "cash", referenceNumber: "", notes: "" });
      load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "paymentId", label: "Payment ID" },
    { key: "customerId", label: "Customer", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "billId", label: "Invoice", render: (v) => (v as { invoiceNumber: string })?.invoiceNumber ?? "" },
    { key: "amount", label: "Amount", render: (v) => <span className="text-emerald-600 font-medium">{formatCurrency(v as number)}</span> },
    { key: "paymentDate", label: "Date", render: (v) => formatDate(v as string) },
    { key: "paymentMode", label: "Mode", render: (v) => <Badge variant="secondary">{String(v).replace("_", " ")}</Badge> },
    { key: "referenceNumber", label: "Ref No" },
  ];

  return (
    <div>
      <PageHeader title="Payments" description="Record and manage payments">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Record Payment</Button>
      </PageHeader>

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={total} page={page} pageSize={20} onPageChange={setPage} emptyMessage="No payments yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Customer *</Label>
              <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v, billId: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Invoice *</Label>
              <Select value={form.billId} onValueChange={(v) => setForm((f) => ({ ...f, billId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select unpaid invoice" /></SelectTrigger>
                <SelectContent>{bills.map((b) => <SelectItem key={b._id} value={b._id}>{b.invoiceNumber} — Outstanding: {formatCurrency(b.outstandingAmount)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Financial Year *</Label>
              <Select value={form.financialYearId} onValueChange={(v) => setForm((f) => ({ ...f, financialYearId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>{financialYears.map((y) => <SelectItem key={y._id} value={y._id}>{y.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedBill && (
              <div className="bg-muted/50 rounded-md p-3 text-xs">
                <div>Total: {formatCurrency(selectedBill.grandTotal)}</div>
                <div className="text-orange-600">Outstanding: {formatCurrency(selectedBill.outstandingAmount)}</div>
              </div>
            )}
            <div>
              <Label>Amount (₹) *</Label>
              <Input className="mt-1" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Payment Date *</Label>
                <Input className="mt-1" type="date" value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={form.paymentMode} onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{payModes.map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Reference / Cheque No</Label>
              <Input className="mt-1" value={form.referenceNumber} onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={handleSave}><Receipt className="h-3.5 w-3.5 mr-1" /> Save & Generate Receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
