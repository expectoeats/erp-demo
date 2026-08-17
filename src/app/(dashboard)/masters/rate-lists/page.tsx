"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Pencil, Building2, MapPin, FileText, Calendar, Calculator } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/lib/utils";

interface RateList {
  _id: string;
  locationId?: { _id: string; name: string };
  subLocationId?: { _id: string; name: string } | null;
  serviceId?: { _id: string; name: string };
  financialYearId?: { _id: string; name: string };
  rate: number;
  unit: string;
  effectiveFrom: Date | string;
  effectiveTo?: Date | string | null;
  isActive: boolean;
}

const empty = { locationId: "", subLocationId: "", serviceId: "", financialYearId: "", rate: 0, unit: "", effectiveFrom: "", effectiveTo: "" };

export default function RateListsPage() {
  const [data, setData] = useState<RateList[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RateList | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/rate-lists?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? (d.data?.length ?? 0));
    setLoading(false);
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(rl: RateList) {
    setEditing(rl);
    setForm({
      locationId: rl.locationId?._id ?? "",
      subLocationId: rl.subLocationId?._id ?? "",
      serviceId: rl.serviceId?._id ?? "",
      financialYearId: rl.financialYearId?._id ?? "",
      rate: rl.rate,
      unit: rl.unit,
      effectiveFrom: typeof rl.effectiveFrom === "string" ? rl.effectiveFrom.split("T")[0] : new Date(rl.effectiveFrom).toISOString().split("T")[0],
      effectiveTo: rl.effectiveTo ? (typeof rl.effectiveTo === "string" ? rl.effectiveTo.split("T")[0] : new Date(rl.effectiveTo).toISOString().split("T")[0]) : "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.rate || form.rate <= 0) { toast.error("Rate is required and must be positive"); return; }
    if (!form.locationId || !form.serviceId || !form.financialYearId || !form.effectiveFrom) {
      toast.error("Location, Service, Financial Year and Effective From are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/rate-lists/${editing._id}` : "/api/rate-lists";
      const method = editing ? "PATCH" : "POST";
      const payload: Record<string, unknown> = {
        locationId: form.locationId,
        serviceId: form.serviceId,
        financialYearId: form.financialYearId,
        rate: Number(form.rate),
        unit: form.unit || "per unit",
        effectiveFrom: form.effectiveFrom,
      };
      if (form.subLocationId) payload.subLocationId = form.subLocationId;
      if (form.effectiveTo) payload.effectiveTo = form.effectiveTo;
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(editing ? "Rate list updated" : "Rate list added");
      setOpen(false);
      load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "locationId", label: "Location",
      render: (v) => (v && typeof v === "object" && "name" in v) ? (v as { name: string }).name : "-",
    },
    {
      key: "subLocationId", label: "Sub Location",
      render: (v) => (v && typeof v === "object" && "name" in v) ? (v as { name: string }).name : "-",
    },
    {
      key: "serviceId", label: "Service",
      render: (v) => (v && typeof v === "object" && "name" in v) ? (v as { name: string }).name : "-",
    },
    {
      key: "financialYearId", label: "Financial Year",
      render: (v) => (v && typeof v === "object" && "name" in v) ? (v as { name: string }).name : "-",
    },
    {
      key: "rate", label: "Rate (₹/unit)",
      render: (v) => formatCurrency(Number(v) || 0),
    },
    { key: "unit", label: "Unit" },
    {
      key: "effectiveFrom", label: "Effective From",
      render: (v) => v ? formatDate(v as Date | string) : "-",
    },
    {
      key: "isActive", label: "Status",
      render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "_id", label: "",
      render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as RateList)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Rate Lists" description="Manage service rates per location and financial year">
        <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Rate</Button>
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
        searchPlaceholder="Search rate lists..."
        emptyMessage="No rate lists yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rate" : "Add Rate"}</DialogTitle>
            <p className="text-sm text-slate-500">
              {editing ? "Update the existing rate details below." : "Enter the details to create a new service rate."}
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
                  <Label htmlFor="rates-location" className="text-xs font-medium text-slate-600">
                    Location ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rates-location"
                    value={form.locationId}
                    onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                    placeholder="Location ObjectId"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rates-sublocation" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> Sub Location ID</span>
                  </Label>
                  <Input
                    id="rates-sublocation"
                    value={form.subLocationId}
                    onChange={(e) => setForm((f) => ({ ...f, subLocationId: e.target.value }))}
                    placeholder="Optional"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rates-service" className="text-xs font-medium text-slate-600">
                    Service ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rates-service"
                    value={form.serviceId}
                    onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                    placeholder="Service ObjectId"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rates-fy" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Financial Year ID</span>
                    <span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="rates-fy"
                    value={form.financialYearId}
                    onChange={(e) => setForm((f) => ({ ...f, financialYearId: e.target.value }))}
                    placeholder="FinancialYear ObjectId"
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
                  <Label htmlFor="rates-value" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Calculator className="h-3 w-3" /> Rate (₹)</span>
                    <span className="text-destructive"> *</span>
                  </Label>
                  <Input
                    id="rates-value"
                    type="number"
                    step="0.01"
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: Number(e.target.value) }))}
                    placeholder="e.g. 12.50"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rates-unit" className="text-xs font-medium text-slate-600">Unit</Label>
                  <Input
                    id="rates-unit"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="e.g. per unit"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rates-from" className="text-xs font-medium text-slate-600">
                    Effective From <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rates-from"
                    type="date"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rates-to" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Effective To</span>
                  </Label>
                  <Input
                    id="rates-to"
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))}
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
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <p className="text-xs text-slate-500">
                  Rate will be applied to bills generated between <span className="font-medium text-slate-700">Effective From</span> and <span className="font-medium text-slate-700">Effective To</span> dates for the selected location and service.
                </p>
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
              {editing ? "Update Rate" : "Save Rate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
