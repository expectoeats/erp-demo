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
import { Plus, Pencil } from "lucide-react";

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

export default function ServicesPage() {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/services");
    const d = await r.json();
    setData(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.name || !form.code) { toast.error("Name and code required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, gstRate: Number(form.gstRate) };
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Service Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Rent" /></div>
            <div><Label>Code *</Label><Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="RENT" /></div>
            <div>
              <Label>Calculation Type *</Label>
              <Select value={form.calculationType} onValueChange={(v) => setForm((f) => ({ ...f, calculationType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{calcTypes.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch checked={form.isTaxable} onCheckedChange={(v) => setForm((f) => ({ ...f, isTaxable: v }))} />
              <Label>Taxable (GST applicable)</Label>
            </div>
            {form.isTaxable && (
              <div>
                <Label>GST Rate %</Label>
                <Input className="mt-1" type="number" value={form.gstRate} onChange={(e) => setForm((f) => ({ ...f, gstRate: parseFloat(e.target.value) || 0 }))} />
              </div>
            )}
            <div className="col-span-2"><Label>Description</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
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
