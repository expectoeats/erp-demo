"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Building2, MapPin, FileText, Activity, Users, Hash } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

type MeterType = "electricity" | "water" | "lpg" | "other";

interface Meter {
  _id: string;
  meterId: string;
  meterNumber: string;
  meterType: MeterType;
  unit?: { _id: string; name: string };
  customer?: { _id: string; name: string };
  initialReading: number;
  currentReading: number;
  isActive: boolean;
  notes?: string;
}

const empty = { meterNumber: "", meterType: "", unitId: "", customerId: "", initialReading: 0, currentReading: 0, notes: "" };

export default function MetersPage() {
  const [data, setData] = useState<Meter[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Meter | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/meters?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`, { signal });
      if (!r.ok) { setData([]); setTotal(0); return; }
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setData([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(meter: Meter) {
    setEditing(meter);
    setForm({
      meterNumber: meter.meterNumber,
      meterType: meter.meterType,
      unitId: meter.unit?._id ?? "",
      customerId: meter.customer?._id ?? "",
      initialReading: meter.initialReading,
      currentReading: meter.currentReading,
      notes: meter.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.meterNumber) { toast.error("Meter number is required"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/meters/${editing._id}` : "/api/meters";
      const method = editing ? "PATCH" : "POST";
      const payload = {
        ...form,
        initialReading: Number(form.initialReading) || 0,
        currentReading: Number(form.currentReading) || 0,
      };
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(editing ? "Meter updated" : "Meter added");
      setOpen(false);
      load();
    } finally { setSaving(false); }
  }

  const meterTypeBadge = (type: MeterType) => {
    const variants: Record<MeterType, "secondary" | "default" | "outline"> = {
      electricity: "secondary",
      water: "secondary",
      lpg: "secondary",
      other: "secondary",
    };
    return <Badge variant={variants[type]} className="capitalize">{type}</Badge>;
  };

  const columns: Column<Record<string, unknown>>[] = [
    { key: "meterId", label: "ID", className: "w-28" },
    { key: "meterNumber", label: "Meter No." },
    {
      key: "meterType", label: "Type",
      render: (v) => meterTypeBadge(v as MeterType),
    },
    { key: "initialReading", label: "Initial Reading" },
    { key: "currentReading", label: "Current Reading" },
    {
      key: "isActive", label: "Status",
      render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "_id", label: "",
      render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as Meter)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Meters" description="Manage utility meters for customers">
        <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Meter</Button>
      </PageHeader>

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
        searchPlaceholder="Search meters..."
        emptyMessage="No meters yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Meter" : "Add Meter"}</DialogTitle>
            <p className="text-sm text-slate-500">
              {editing ? "Update the existing meter details below." : "Enter the details to create a new utility meter."}
            </p>
          </DialogHeader>

          <div className="space-y-6 px-6 py-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Basic Information</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meter-number" className="text-xs font-medium text-slate-600">
                    Meter Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="meter-number"
                    value={form.meterNumber}
                    onChange={(e) => setForm((f) => ({ ...f, meterNumber: e.target.value }))}
                    placeholder="e.g. EL-001234"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meter-type" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" /> Meter Type</span>
                  </Label>
                  <Input
                    id="meter-type"
                    value={form.meterType}
                    onChange={(e) => setForm((f) => ({ ...f, meterType: e.target.value }))}
                    placeholder="electricity | water | lpg | other"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Details</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="meter-unit" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> Unit ID</span>
                  </Label>
                  <Input
                    id="meter-unit"
                    value={form.unitId}
                    onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
                    placeholder="Unit ObjectId"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meter-customer" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Customer ID</span>
                  </Label>
                  <Input
                    id="meter-customer"
                    value={form.customerId}
                    onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                    placeholder="Customer ObjectId"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meter-initial" className="text-xs font-medium text-slate-600">Initial Reading</Label>
                  <Input
                    id="meter-initial"
                    type="number"
                    value={form.initialReading}
                    onChange={(e) => setForm((f) => ({ ...f, initialReading: Number(e.target.value) }))}
                    placeholder="0"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meter-current" className="text-xs font-medium text-slate-600">Current Reading</Label>
                  <Input
                    id="meter-current"
                    type="number"
                    value={form.currentReading}
                    onChange={(e) => setForm((f) => ({ ...f, currentReading: Number(e.target.value) }))}
                    placeholder="0"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Additional Information</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meter-notes" className="text-xs font-medium text-slate-600">Notes</Label>
                <Textarea
                  id="meter-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes about this meter..."
                  className="border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-9 border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              onClick={handleSave}
              className="h-9 px-5 text-sm font-medium shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
            >
              {editing ? "Update Meter" : "Save Meter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
