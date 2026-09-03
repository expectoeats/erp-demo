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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Zap, Calculator, Receipt, Percent, FileText } from "lucide-react";

interface Service {
  _id: string;
  serviceId: string;
  name: string;
  code: string;
  calculationType: string;
  gstRate: number;
  isTaxable: boolean;
  isActive: boolean;
}

const empty = { name: "", code: "", billingType: "Monthly", calculationType: "MANUAL", isTaxable: false, gstRate: 0, isActive: true, description: "" };

const calcTypes = [
  { value: "AREA_RATE", label: "Area × Rate" },
  { value: "QUANTITY_RATE", label: "Quantity × Rate" },
  { value: "FIXED", label: "Fixed Amount" },
  { value: "MANUAL", label: "Manual Entry" },
  { value: "METER", label: "Meter Consumption × Rate" },
];

const inputBase = "h-10 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all";

export default function ServicesPage() {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch("/api/services", { signal });
      if (!r.ok) { setData([]); return; }
      const d = await r.json();
      setData(d.data ?? []);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  async function handleSave() {
    if (!form.name || !form.code) { toast.error("Name and code required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, gstRate: form.isTaxable ? Number(form.gstRate) : 0 };
      const url = editing ? `/api/services/${editing._id}` : "/api/services";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success("Saved");
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "serviceId", label: "ID", className: "w-24" },
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "calculationType", label: "Calc Type", render: (v) => calcTypes.find((c) => c.value === v)?.label ?? String(v) },
    { key: "gstRate", label: "GST %", render: (v, row) => row.isTaxable ? `${v}%` : "—" },
    { key: "isActive", label: "Status", render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge> },
    {
      key: "_id", label: "", render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => {
          const s = row as unknown as Service;
          setEditing(s);
          setForm({ name: s.name, code: s.code, billingType: "Monthly", calculationType: s.calculationType, isTaxable: s.isTaxable, gstRate: s.gstRate, isActive: s.isActive, description: "" });
          setOpen(true);
        }}><Pencil className="h-3.5 w-3.5" /></Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Services" description="Define billable services like Rent, Electricity, Water">
        <Button size="sm" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={data.length} emptyMessage="No services. Add services to start billing." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Service" : "Add Service"}</DialogTitle></DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <Receipt className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Service Details</h3>
                  <p className="text-[11px] text-slate-500">Basic service identification</p>
                </div>
              </div>
              <div className="h-px bg-slate-200 w-full" />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="col-span-2">
                  <Label>Service Name *</Label>
                  <Input className={`mt-1 ${inputBase}`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Rent" />
                </div>
                <div>
                  <Label>Code *</Label>
                  <Input className={`mt-1 ${inputBase} font-mono uppercase tracking-wide`} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="RENT" />
                </div>
                <div>
                  <Label>Calculation Type *</Label>
                  <Select value={form.calculationType} onValueChange={(v) => setForm((f) => ({ ...f, calculationType: v }))}>
                    <SelectTrigger className={`mt-1 ${inputBase}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{calcTypes.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <Zap className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Tax Configuration</h3>
                  <p className="text-[11px] text-slate-500">GST and taxability settings</p>
                </div>
              </div>
              <div className="h-px bg-slate-200 w-full" />
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.isTaxable} onCheckedChange={(v) => setForm((f) => ({ ...f, isTaxable: v, gstRate: v ? f.gstRate || 18 : 0 }))} />
                    <div>
                      <Label className="text-sm">Taxable (GST applicable)</Label>
                      <p className="text-[11px] text-slate-500">{form.isTaxable ? "GST will be auto-calculated on bill" : "No tax for this service (e.g. Water 0%)"}</p>
                    </div>
                  </div>
                  {form.isTaxable ? (
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">GST ON</span>
                  ) : (
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">EXEMPT</span>
                  )}
                </div>

                {form.isTaxable && (
                  <div className="space-y-3 p-4 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-orange-50/40">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-200/70 text-amber-700">
                        <Percent className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-800">GST Rate %</Label>
                        <p className="text-[10px] text-slate-500">Standard slab or custom rate</p>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Input className={`h-10 bg-white ${inputBase}`} type="number" min={0} max={100} step={0.5} value={form.gstRate} onChange={(e) => setForm((f) => ({ ...f, gstRate: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))} placeholder="18" />
                      <span className="text-sm font-mono font-semibold text-slate-600 w-6">%</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[0, 5, 12, 18, 28].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, gstRate: p }))}
                          className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all ${
                            form.gstRate === p
                              ? "bg-primary text-white border-primary shadow-sm shadow-primary/25 scale-[1.02]"
                              : "bg-white hover:bg-slate-100 border-slate-200 hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <div className="h-px bg-amber-200/60 w-full" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                          <Calculator className="h-3.5 w-3.5" />
                        </div>
                        <Label className="text-xs font-semibold text-slate-800">Live Preview</Label>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-white border border-amber-200/50">
                        <div className="text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Base</p>
                          <p className="text-sm font-mono font-semibold text-slate-900 mt-0.5">₹1,000.00</p>
                        </div>
                        <div className="text-center border-x border-slate-200">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">+ GST {form.gstRate}%</p>
                          <p className="text-sm font-mono font-semibold text-amber-700 mt-0.5">₹{(1000 * form.gstRate / 100).toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total</p>
                          <p className="text-sm font-mono font-bold text-emerald-700 mt-0.5">₹{(1000 + 1000 * form.gstRate / 100).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Additional Info</h3>
                  <p className="text-[11px] text-slate-500">Optional service notes</p>
                </div>
              </div>
              <div className="h-px bg-slate-200 w-full" />
              <div className="pt-1">
                <Label>Description</Label>
                <Textarea className="mt-1 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all resize-none" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional notes about this service..." />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" loading={saving} onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
