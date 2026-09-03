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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { calculateBill } from "@/lib/billing-engine";
import { Zap, Calculator, Activity } from "lucide-react";

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

  const [initialLoading, setInitialLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitLoading, setUnitLoading] = useState(false);

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
  // Meter reading pop-up state (start/end capture)
  const [meterModal, setMeterModal] = useState<{ idx: number | null; start: string; end: string }>({ idx: null, start: "", end: "" });

  // Parallel initial load with abort + silent error handling (no popup spam)
  useEffect(() => {
    const abort = new AbortController();
    let mounted = true;
    async function loadInitial() {
      try {
        setInitialLoading(true);
        const [fyRes, btRes, custRes] = await Promise.all([
          fetch("/api/financial-years", { signal: abort.signal }),
          fetch("/api/bill-types", { signal: abort.signal }),
          fetch("/api/customers?limit=200", { signal: abort.signal }),
        ]);
        const [fyJson, btJson, custJson] = await Promise.all([
          fyRes.ok ? fyRes.json() : Promise.resolve({ data: [] as unknown[] }),
          btRes.ok ? btRes.json() : Promise.resolve({ data: [] as unknown[] }),
          custRes.ok ? custRes.json() : Promise.resolve({ data: [] as unknown[] }),
        ]);
        if (!mounted) return;
        setFinancialYears(fyJson.data ?? []);
        setBillTypes(btJson.data ?? []);
        setCustomers(custJson.data ?? []);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        if (mounted) setInitialLoading(false);
      }
    }
    loadInitial();
    return () => { mounted = false; abort.abort(); };
  }, []);

  useEffect(() => {
    if (!form.customerId) { setUnits([]); setUnitsLoading(false); return; }
    const abort = new AbortController();
    let mounted = true;
    async function loadUnits() {
      try {
        setUnitsLoading(true);
        const r = await fetch(`/api/units?customerId=${form.customerId}&limit=50`, { signal: abort.signal });
        if (!r.ok) return;
        const d = await r.json();
        if (!mounted) return;
        setUnits(d.data ?? []);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        if (mounted) setUnitsLoading(false);
      }
    }
    loadUnits();
    return () => { mounted = false; abort.abort(); };
  }, [form.customerId]);

  useEffect(() => {
    if (!form.unitId) { setSelectedUnit(null); setServiceLines([]); setUnitLoading(false); return; }
    const abort = new AbortController();
    let mounted = true;
    async function loadUnit() {
      try {
        setUnitLoading(true);
        const r = await fetch(`/api/units/${form.unitId}`, { signal: abort.signal });
        if (!r.ok) return;
        const d = await r.json();
        if (!mounted) return;
        const u: Unit = d.data?.unit;
        if (!u) return;
        setSelectedUnit(u);
        const lines: ServiceLine[] = (u?.services ?? []).map((s) => ({
          serviceId: s._id,
          serviceName: s.name,
          serviceCode: s.code,
          calculationType: s.calculationType,
          quantity: s.calculationType === "AREA_RATE" ? (u.area ?? 0) : s.calculationType === "METER" ? 0 : 1,
          unit: s.calculationType === "AREA_RATE" ? (u.areaUnit ?? "sq.m") : s.calculationType === "METER" ? "kWh" : "unit",
          rate: s.calculationType === "AREA_RATE" ? (u.rentRate ?? 0) : 0,
          manualAmount: 0,
          isTaxable: s.isTaxable,
          gstRate: Number(s.gstRate) || 0,
          notes: "",
        }));
        setServiceLines(lines);
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      } finally {
        if (mounted) setUnitLoading(false);
      }
    }
    loadUnit();
    return () => { mounted = false; abort.abort(); };
  }, [form.unitId]);

  function updateLine(idx: number, key: keyof ServiceLine, value: unknown) {
    setServiceLines((prev) => prev.map((l, i) => i === idx ? { ...l, [key]: value } : l));
  }

  function openMeterModal(idx: number) {
    const line = serviceLines[idx];
    // try to parse notes like "Meter: 1200 -> 1350" else empty
    const match = line.notes?.match(/(\d+)\s*->\s*(\d+)/);
    setMeterModal({ idx, start: match?.[1] ?? "", end: match?.[2] ?? String(line.quantity || "") });
  }
  function confirmMeterModal() {
    if (meterModal.idx === null) return;
    const s = parseFloat(meterModal.start);
    const e = parseFloat(meterModal.end);
    if (isNaN(s) || isNaN(e)) { toast.error("Start and End readings required"); return; }
    if (e < s) { toast.error("End reading cannot be less than Start reading"); return; }
    const consumption = e - s;
    setServiceLines((prev) => prev.map((l, i) => i === meterModal.idx ? { ...l, quantity: consumption, notes: `Meter: ${s} → ${e} = ${consumption} ${l.unit}` } : l));
    setMeterModal({ idx: null, start: "", end: "" });
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
    // Validate METER lines have quantity
    const invalidMeter = serviceLines.find((l) => l.calculationType === "METER" && (!l.quantity || l.quantity <= 0));
    if (invalidMeter) {
      toast.error(`Please capture meter reading for ${invalidMeter.serviceName} (Start/End units)`);
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
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 409 && d.error) { toast.error(d.error); return; }
        toast.error(d.error || "Failed to generate bill. Please retry."); return;
      }
      toast.success(`Bill generated: ${d.data.invoiceNumber}`);
      router.push(`/transactions/bills/${d.data._id}`);
    } catch {
      toast.error("Network error while generating bill. Please check connection and retry.");
    } finally {
      setSaving(false);
    }
  }

  const skeletonBar = (w: string = "w-full", h: string = "h-9") => (
    <div className={`${h} ${w} bg-gradient-to-r from-slate-200/70 via-slate-200/50 to-slate-200/70 rounded relative overflow-hidden`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );

  return (
    <div className="max-w-4xl">
      <PageHeader title="Generate Bill" description="Create a new monthly billing invoice" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Header */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Bill Details
                {initialLoading && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
                    Loading masters…
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Financial Year *</Label>
                  {initialLoading ? (
                    <div className="mt-1">{skeletonBar()}</div>
                  ) : (
                    <Select value={form.financialYearId} onValueChange={(v) => setForm((f) => ({ ...f, financialYearId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{financialYears.map((y) => <SelectItem key={y._id} value={y._id}>{y.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <Label>Bill Type *</Label>
                  {initialLoading ? (
                    <div className="mt-1">{skeletonBar()}</div>
                  ) : (
                    <Select value={form.billTypeId} onValueChange={(v) => setForm((f) => ({ ...f, billTypeId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{billTypes.map((b) => <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
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
                  <Label className="flex items-center gap-2">
                    Customer *
                    {initialLoading && <span className="text-[10px] text-slate-400">(loading client list…)</span>}
                  </Label>
                  {initialLoading ? (
                    <div className="mt-1">{skeletonBar()}</div>
                  ) : (
                    <Select value={form.customerId} onValueChange={(v) => setForm((f) => ({ ...f, customerId: v, unitId: "" }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.name} ({c.customerId})</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="flex items-center gap-2">
                    Unit *
                    {unitsLoading && <span className="text-[10px] text-slate-400">(fetching units…)</span>}
                  </Label>
                  {unitsLoading ? (
                    <div className="mt-1">{skeletonBar()}</div>
                  ) : (
                    <Select value={form.unitId} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={form.customerId ? "Select unit" : "Select a customer first"} /></SelectTrigger>
                      <SelectContent>{units.map((u) => <SelectItem key={u._id} value={u._id}>{u.unitCode} ({u.unitId})</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Lines */}
          {unitLoading ? (
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Loading unit services…
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[0, 1].map((si) => (
                  <div key={si} className="border rounded-xl p-3.5 space-y-3 bg-white animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${si * 80}ms` }}>
                    {skeletonBar("w-2/5", "h-4")}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {skeletonBar("", "h-8")}
                      {skeletonBar("", "h-8")}
                      {skeletonBar("", "h-8")}
                    </div>
                    <div className="p-2.5 rounded-lg border bg-slate-50/70 space-y-2">
                      {skeletonBar("w-32", "h-3.5")}
                      {skeletonBar("", "h-8")}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : serviceLines.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Services — check GST & meter readings</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  {serviceLines.map((line, idx) => {
                    const linePreview = calculateBill({
                      services: [{ ...line, calculationType: line.calculationType as import("@/lib/models/Service").CalculationType, manualAmount: line.calculationType === "MANUAL" ? (line.manualAmount ?? 0) : undefined }],
                      discount: 0, otherCharges: 0,
                    }).items[0];
                    return (
                    <div key={line.serviceId} className={`border rounded-xl p-3.5 space-y-3 ${line.calculationType==="METER"?"border-amber-200 bg-amber-50/20":"bg-white"}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">{line.serviceName}</span>
                        <span className="text-[10px] font-medium tracking-wide uppercase bg-slate-100 border px-2 py-0.5 rounded-full">{line.calculationType}</span>
                      </div>

                      {/* Quantity / Rate row */}
                      <div className="grid grid-cols-3 gap-2">
                        {line.calculationType === "MANUAL" ? (
                          <div className="col-span-3">
                            <Label className="text-xs">Amount (₹)</Label>
                            <Input className="mt-1 h-9 text-sm bg-white" type="number" value={line.manualAmount ?? 0}
                              onChange={(e) => updateLine(idx, "manualAmount", parseFloat(e.target.value) || 0)} />
                          </div>
                        ) : line.calculationType === "METER" ? (
                          <>
                            <div className="col-span-3 p-2.5 rounded-lg bg-white border border-amber-200 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-700">Meter Consumption</p>
                                <p className="text-xs font-mono text-slate-600">{line.quantity} {line.unit} × {formatCurrency(line.rate)} = <span className="font-bold text-slate-900">{formatCurrency(linePreview.amount)}</span></p>
                                {line.notes && <p className="text-[11px] text-amber-700 mt-0.5">{line.notes}</p>}
                              </div>
                              <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-50" onClick={() => openMeterModal(idx)}>Capture Reading</Button>
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Rate per {line.unit} (₹)</Label>
                              <Input className="mt-1 h-8 text-xs bg-white" type="number" value={line.rate}
                                onChange={(e) => updateLine(idx, "rate", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <Label className="text-xs">Consumption (auto)</Label>
                              <Input className="mt-1 h-8 text-xs bg-slate-50" type="number" value={line.quantity} readOnly />
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <Label className="text-xs">Quantity</Label>
                              <Input className="mt-1 h-8 text-xs bg-white" type="number" value={line.quantity}
                                onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <Label className="text-xs">Unit</Label>
                              <Input className="mt-1 h-8 text-xs bg-white" value={line.unit}
                                onChange={(e) => updateLine(idx, "unit", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Rate (₹)</Label>
                              <Input className="mt-1 h-8 text-xs bg-white" type="number" value={line.rate}
                                onChange={(e) => updateLine(idx, "rate", parseFloat(e.target.value) || 0)} />
                            </div>
                          </>
                        )}
                      </div>

                      {/* Dynamic GST per-line (variable tax) */}
                      <div className="p-2.5 rounded-lg border bg-slate-50/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch checked={line.isTaxable} onCheckedChange={(v) => { updateLine(idx, "isTaxable", v); if (!v) updateLine(idx, "gstRate", 0); }} />
                            <Label className="text-xs font-semibold">GST Applicable</Label>
                          </div>
                          {line.isTaxable && <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{line.gstRate}%</span>}
                          {!line.isTaxable && <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">0% Exempt</span>}
                        </div>
                        {line.isTaxable ? (
                          <div className="space-y-1.5">
                            <div className="flex gap-2 items-center">
                              <Input className="h-8 text-xs bg-white flex-1" type="number" min={0} max={100} step={0.5} value={line.gstRate} onChange={(e) => updateLine(idx, "gstRate", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))} placeholder="18" />
                              <span className="text-xs font-mono">%</span>
                              <div className="flex gap-1 flex-wrap">
                                {[{v:0,l:"0% Water"},{v:5,l:"5%"},{v:12,l:"12%"},{v:18,l:"18%"},{v:28,l:"28%"}].map((c) => (
                                  <button key={c.v} type="button" onClick={() => { updateLine(idx, "gstRate", c.v); if (c.v>0 && !line.isTaxable) updateLine(idx, "isTaxable", true); if (c.v===0) updateLine(idx, "isTaxable", false); }} className={`px-2 py-1 text-[11px] rounded-full border whitespace-nowrap transition-colors ${line.gstRate===c.v?"bg-primary text-white border-primary":"bg-white border-slate-200 hover:border-slate-300"}`}>{c.l}</button>
                                ))}
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600">GST: <span className="font-mono font-semibold">{formatCurrency(linePreview.gstAmount)}</span> → Line Total <span className="font-mono font-bold text-slate-900">{formatCurrency(linePreview.totalAmount)}</span></p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex gap-1 flex-wrap">
                              {[{v:0,l:"0% Water"},{v:5,l:"5%"},{v:12,l:"12%"},{v:18,l:"18%"},{v:28,l:"28%"}].map((c) => (
                                <button key={c.v} type="button" onClick={() => { updateLine(idx, "gstRate", c.v); if (c.v>0) updateLine(idx, "isTaxable", true); }} className={`px-2 py-1 text-[11px] rounded-full border whitespace-nowrap transition-colors ${!line.isTaxable && c.v===0?"bg-primary text-white border-primary":c.v===0?"bg-sky-50 border-sky-200 text-sky-700":"bg-white border-slate-200 hover:border-slate-300"}`}>{c.l}</button>
                              ))}
                            </div>
                            <p className="text-[11px] text-slate-500">No tax for this line (e.g. Water / exempt). Line Total = <span className="font-mono font-bold text-slate-900">{formatCurrency(linePreview.totalAmount)}</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 gap-3">
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
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Bill Preview
                {(initialLoading || unitLoading) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {initialLoading || unitLoading ? (
                <div className="flex flex-col gap-2.5 text-xs">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex justify-between items-start gap-2 animate-in fade-in slide-in-from-bottom-0.5" style={{ animationDelay: `${i * 60}ms` }}>
                      <div className="flex-1 space-y-1">
                        {skeletonBar("w-5/6", "h-3")}
                        {skeletonBar("w-2/5", "h-2.5")}
                      </div>
                      <div className="space-y-1">
                        {skeletonBar("w-16", "h-3")}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-1" />
                  <div className="flex justify-between">{skeletonBar("w-16", "h-3")}{skeletonBar("w-20", "h-3")}</div>
                  <div className="flex justify-between">{skeletonBar("w-14", "h-3")}{skeletonBar("w-20", "h-3")}</div>
                  <div className="flex justify-between">{skeletonBar("w-16", "h-3")}{skeletonBar("w-20", "h-3")}</div>
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center">
                    {skeletonBar("w-24", "h-4")}
                    {skeletonBar("w-24", "h-5")}
                  </div>
                </div>
              ) : !preview ? (
                <p className="text-xs text-muted-foreground">Select customer and unit to see preview</p>
              ) : (
                <div className="flex flex-col gap-2 text-xs">
                  {preview.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground flex-1">{item.serviceName} {item.isTaxable ? <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.5 rounded ml-1">GST {item.gstRate}%</span> : null}<br/><span className="text-[11px]">{item.quantity} × {formatCurrency(item.rate)}</span></span>
                      <span className="text-right"><span className="block">{formatCurrency(item.amount)}</span>{item.gstAmount>0 && <span className="text-[11px] text-emerald-600">+{formatCurrency(item.gstAmount)} GST</span>}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(preview.subtotal)}</span></div>
                  {preview.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span className="font-mono">- {formatCurrency(preview.discount)}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span className="font-mono">{formatCurrency(preview.taxableAmount)}</span></div>
                  <div className="flex justify-between"><span className={preview.totalGst>0?"text-emerald-700 font-semibold":"text-muted-foreground"}>Total GST</span><span className="font-mono font-semibold">{formatCurrency(preview.totalGst)}</span></div>
                  {preview.otherCharges > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Other Charges</span><span className="font-mono">{formatCurrency(preview.otherCharges)}</span></div>}
                  {preview.roundOff !== 0 && <div className="flex justify-between"><span className="text-muted-foreground">Round Off</span><span className="font-mono">{formatCurrency(preview.roundOff)}</span></div>}
                  <Separator />
                  <div className="flex justify-between font-bold text-sm"><span>Grand Total</span><span className="font-mono text-primary">{formatCurrency(preview.grandTotal)}</span></div>
                </div>
              )}

              <Button className="w-full mt-4" size="sm" loading={saving} onClick={handleSubmit} disabled={!preview || initialLoading || unitLoading}>
                Generate Bill
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Meter Reading Pop-up Modal — sectioned icon-badge layout */}
      <Dialog open={meterModal.idx !== null} onOpenChange={(o) => !o && setMeterModal({ idx: null, start: "", end: "" })}>
        <DialogContent className="max-w-md">
          <DialogHeader className="pb-3 border-b border-slate-100 -mx-6 -mt-6 px-6 pt-5 mb-1 bg-slate-50/60 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-700" strokeWidth={2} />
              </div>
              <div>
                <DialogTitle className="text-sm text-slate-900">Capture Meter Reading</DialogTitle>
                <p className="text-[11px] text-slate-500 mt-0.5">{meterModal.idx !== null ? serviceLines[meterModal.idx]?.serviceName + " · " + (serviceLines[meterModal.idx]?.unit ?? "unit") : ""}</p>
              </div>
            </div>
          </DialogHeader>

          {/* Section 1: Readings */}
          <div className="flex items-center gap-2 pt-1 pb-2">
            <div className="w-7 h-7 rounded-md bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5 text-indigo-700" />
            </div>
            <span className="text-xs font-semibold text-slate-800 tracking-wide uppercase">Reading Input</span>
            <div className="flex-1 h-px bg-slate-200 ml-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start Unit *</Label>
              <Input className="mt-1 h-10 text-sm bg-slate-50/60 focus:ring-4 focus:ring-primary/10" type="number" placeholder="e.g. 1200" value={meterModal.start} onChange={(e) => setMeterModal((m) => ({ ...m, start: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">End Unit *</Label>
              <Input className="mt-1 h-10 text-sm bg-slate-50/60 focus:ring-4 focus:ring-primary/10" type="number" placeholder="e.g. 1350" value={meterModal.end} onChange={(e) => setMeterModal((m) => ({ ...m, end: e.target.value }))} />
            </div>
          </div>

          {/* Section 2: Consumption Preview */}
          <div className="flex items-center gap-2 pt-4 pb-2">
            <div className="w-7 h-7 rounded-md bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
              <Calculator className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <span className="text-xs font-semibold text-slate-800 tracking-wide uppercase">Calculation Preview</span>
            <div className="flex-1 h-px bg-slate-200 ml-2" />
          </div>
          <div className="space-y-2">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              {(() => {
                const s = parseFloat(meterModal.start); const e = parseFloat(meterModal.end);
                const line = meterModal.idx !== null ? serviceLines[meterModal.idx] : undefined;
                if (isNaN(s) || isNaN(e)) return <p className="text-slate-500">Enter both readings to compute consumption.</p>;
                if (e < s) return <p className="text-rose-700 font-semibold">End reading must be ≥ Start reading.</p>;
                const consumption = e - s;
                const lineAmt = line ? formatCurrency(consumption * (line.rate ?? 0)) : "—";
                return (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between"><span className="text-slate-500">Start</span><span className="font-mono font-semibold text-slate-800">{s}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">End</span><span className="font-mono font-semibold text-slate-800">{e}</span></div>
                    <div className="h-px bg-slate-200 my-1" />
                    <div className="flex justify-between"><span className="font-semibold text-slate-700">Consumption</span><span className="font-mono font-bold text-emerald-700">{consumption} {line?.unit ?? "unit"}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Line Amount</span><span className="font-mono font-bold text-slate-900">{lineAmt}</span></div>
                    {consumption === 0 && (
                      <div className="mt-1.5 px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-[11px] text-amber-800 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 shrink-0" />
                        Zero consumption — allowed but please verify.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          <DialogFooter className="pt-3 mt-2 border-t border-slate-100 -mx-6 -mb-6 px-6 pb-5 rounded-b-xl">
            <Button variant="outline" size="sm" onClick={() => setMeterModal({ idx: null, start: "", end: "" })}>Cancel</Button>
            <Button size="sm" onClick={confirmMeterModal}>
              {(() => {
                const s = parseFloat(meterModal.start); const e = parseFloat(meterModal.end);
                if (!isNaN(s) && !isNaN(e) && e >= s) return `Confirm & Apply ${e - s} units`;
                return "Confirm & Fill";
              })()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
