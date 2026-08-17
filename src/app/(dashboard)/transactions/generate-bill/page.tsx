"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { calculateBill } from "@/lib/billing-engine";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface FY { _id: string; name: string; }
interface BillType { _id: string; name: string; prefix: string; }
interface Customer { _id: string; name: string; customerId: string; }
interface Unit { _id: string; unitCode: string; unitId: string; locationId: { _id: string; name: string }; subLocationId: { _id: string; name: string }; services: Service[]; area?: number; areaUnit?: string; rentRate?: number; }
interface Service { _id: string; name: string; code: string; calculationType: string; isTaxable: boolean; gstRate: number; }

interface ServiceLine {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  calculationType: string;
  quantity: number;
  unit: string;
  rate: number;
  manualAmount?: number;
  isTaxable: boolean;
  gstRate: number;
  notes: string;
}

export default function GenerateBillPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [financialYears, setFinancialYears] = useState<FY[]>([]);
  const [billTypes, setBillTypes] = useState<BillType[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [form, setForm] = useState({
    financialYearId: "", billTypeId: "", customerId: "", unitId: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    billingMonth: MONTHS[new Date().getMonth()],
    billingYear: new Date().getFullYear(),
    discount: 0, otherCharges: 0, applyRoundOff: false, notes: "",
  });

  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([]);

  useEffect(() => {
    fetch("/api/financial-years").then((r) => r.json()).then((d) => setFinancialYears(d.data ?? []));
    fetch("/api/bill-types").then((r) => r.json()).then((d) => setBillTypes(d.data ?? []));
    fetch("/api/customers?limit=200").then((r) => r.json()).then((d) => setCustomers(d.data ?? []));
  }, []);

  useEffect(() => {
    if (form.customerId) {
      fetch(`/api/units?customerId=${form.customerId}&limit=50`)
        .then((r) => r.json()).then((d) => setUnits(d.data ?? []));
    }
  }, [form.customerId]);

  useEffect(() => {
    if (form.unitId) {
      fetch(`/api/units/${form.unitId}`)
        .then((r) => r.json())
        .then((d) => {
          const u: Unit = d.data?.unit;
          setSelectedUnit(u);
          // Auto-populate service lines from unit's services
          const lines: ServiceLine[] = (u?.services ?? []).map((s) => ({
            serviceId: s._id,
            serviceName: s.name,
            serviceCode: s.code,
            calculationType: s.calculationType,
            quantity: s.calculationType === "AREA_RATE" ? (u.area ?? 0) : 1,
            unit: s.calculationType === "AREA_RATE" ? (u.areaUnit ?? "sq.m") : "unit",
            rate: s.calculationType === "AREA_RATE" ? (u.rentRate ?? 0) : 0,
            manualAmount: 0,
            isTaxable: s.isTaxable,
            gstRate: s.gstRate,
            notes: "",
          }));
          setServiceLines(lines);
        });
    }
  }, [form.unitId]);

  function updateLine(idx: number, key: keyof ServiceLine, value: unknown) {
    setServiceLines((prev) => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
  }

  // Live billing preview
  const preview = serviceLines.length > 0
    ? calculateBill({
        services: serviceLines.map((l) => ({
          ...l,
          calculationType: l.calculationType as import("@/lib/models/Service").CalculationType,
          manualAmount: l.calculationType === "MANUAL" ? (l.manualAmount ?? 0) : undefined,
        })),
        discount: form.discount,
        otherCharges: form.otherCharges,
        applyRoundOff: form.applyRoundOff,
      })
    : null;

  async function handleSubmit() {
    if (!form.financialYearId || !form.billTypeId || !form.customerId || !form.unitId) {
      toast.error("Please fill all required fields");
      return;
    }
    if (serviceLines.length === 0) {
      toast.error("No services on this bill");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        locationId: selectedUnit?.locationId?._id,
        subLocationId: selectedUnit?.subLocationId?._id,
        services: serviceLines,
      };

      const r = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(`Bill generated: ${d.data.invoiceNumber}`);
      router.push(`/transactions/bills/${d.data._id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Generate Bill" description="Create a new monthly billing invoice" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Header */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Bill Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Financial Year *</Label>
                  <Select value={form.financialYearId} onValueChange={(v) => setForm((f) => ({ ...f, financialYearId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{financialYears.map((y) => <SelectItem key={y._id} value={y._id}>{y.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bill Type *</Label>
                  <Select value={form.billTypeId} onValueChange={(v) => setForm((f) => ({ ...f, billTypeId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{billTypes.map((b) => <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Billing Month *</Label>
                  <Select value={form.billingMonth} onValueChange={(v) => setForm((f) => ({ ...f, billingMonth: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Billing Year *</Label>
                  <Input className="mt-1" type="number" value={form.billingYear} onChange={(e) => setForm((f) => ({ ...f, billingYear: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <Label>Invoice Date *</Label>
                  <Input className="mt-1" type="date" value={form.invoiceDate} onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input className="mt-1" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer & Unit */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Customer & Unit</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Customer *</Label>
                  <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v, unitId: "" }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.name} ({c.customerId})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Unit *</Label>
                  <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>{units.map((u) => <SelectItem key={u._id} value={u._id}>{u.unitCode} ({u.unitId})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Lines */}
          {serviceLines.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Services</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {serviceLines.map((line, idx) => (
                    <div key={line.serviceId} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">{line.serviceName}</span>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{line.calculationType}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {line.calculationType === "MANUAL" ? (
                          <div className="col-span-3">
                            <Label className="text-xs">Amount (₹)</Label>
                            <Input className="mt-1 h-8 text-xs" type="number" value={line.manualAmount ?? 0}
                              onChange={(e) => updateLine(idx, "manualAmount", parseFloat(e.target.value) || 0)} />
                          </div>
                        ) : (
                          <>
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input className="mt-1 h-8 text-xs" type="number" value={line.quantity}
                                onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <Label className="text-xs">Unit</Label>
                              <Input className="mt-1 h-8 text-xs" value={line.unit}
                                onChange={(e) => updateLine(idx, "unit", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Rate (₹)</Label>
                              <Input className="mt-1 h-8 text-xs" type="number" value={line.rate}
                                onChange={(e) => updateLine(idx, "rate", parseFloat(e.target.value) || 0)} />
                            </div>
                          </>
                        )}
                        {line.isTaxable && (
                          <div className="col-span-3 text-xs text-muted-foreground">
                            GST @ {line.gstRate}% applies
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Discount (₹)</Label>
                    <Input className="mt-1 h-8 text-xs" type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Other Charges (₹)</Label>
                    <Input className="mt-1 h-8 text-xs" type="number" value={form.otherCharges} onChange={(e) => setForm((f) => ({ ...f, otherCharges: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preview */}
        <div>
          <Card className="sticky top-4">
            <CardHeader><CardTitle className="text-sm">Bill Preview</CardTitle></CardHeader>
            <CardContent>
              {!preview ? (
                <p className="text-xs text-muted-foreground">Select customer and unit to see preview</p>
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  {preview.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{item.serviceName}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(preview.subtotal)}</span></div>
                  {preview.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>- {formatCurrency(preview.discount)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{formatCurrency(preview.taxableAmount)}</span></div>
                  {preview.totalGst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{formatCurrency(preview.totalGst)}</span></div>}
                  {preview.otherCharges > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Other Charges</span><span>{formatCurrency(preview.otherCharges)}</span></div>}
                  {preview.roundOff !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round Off</span><span>{formatCurrency(preview.roundOff)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-semibold text-sm"><span>Grand Total</span><span>{formatCurrency(preview.grandTotal)}</span></div>
                </div>
              )}

              <Button className="w-full mt-4" size="sm" loading={saving} onClick={handleSubmit} disabled={!preview}>
                Generate Bill
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
