"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Activity, BarChart } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate } from "@/lib/utils";

interface MeterReading {
  _id: string;
  meterId: string;
  unitId?: { _id: string; unitCode: string };
  customerId?: { _id: string; name: string };
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingDate: string;
  billingMonth: string;
  billingYear: number;
  notes?: string;
}

const months = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const emptyForm = {
  meterId: "",
  readingDate: "",
  billingMonth: "",
  billingYear: String(new Date().getFullYear()),
  previousReading: "",
  currentReading: "",
  notes: "",
};

export default function MeterReadingsPage() {
  const [data, setData] = useState<MeterReading[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeterReading | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const consumptionHint = useMemo(() => {
    const prev = parseFloat(form.previousReading);
    const curr = parseFloat(form.currentReading);
    if (!isNaN(prev) && !isNaN(curr) && curr >= prev) {
      return `Consumption: ${curr - prev} units (auto-calculated)`;
    }
    return "Consumption will auto-calculate";
  }, [form.previousReading, form.currentReading]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/meter-readings?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`);
      if (!r.ok) throw new Error("Failed");
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(mr: MeterReading) {
    setEditing(mr);
    setForm({
      meterId: mr.meterId,
      readingDate: mr.readingDate ? mr.readingDate.slice(0, 10) : "",
      billingMonth: mr.billingMonth,
      billingYear: String(mr.billingYear ?? new Date().getFullYear()),
      previousReading: String(mr.previousReading ?? ""),
      currentReading: String(mr.currentReading ?? ""),
      notes: mr.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.meterId || !form.readingDate) {
      toast.error("Meter ID and reading date are required");
      return;
    }
    if (form.previousReading === "" || form.currentReading === "") {
      toast.error("Previous and current readings are required");
      return;
    }
    const prev = parseFloat(form.previousReading);
    const curr = parseFloat(form.currentReading);
    if (isNaN(prev) || isNaN(curr)) {
      toast.error("Readings must be valid numbers");
      return;
    }
    if (curr < prev) {
      toast.error("Current reading cannot be less than previous reading");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        meterId: form.meterId,
        readingDate: form.readingDate,
        billingMonth: form.billingMonth || undefined,
        billingYear: form.billingYear ? parseInt(form.billingYear) : undefined,
        previousReading: prev,
        currentReading: curr,
        consumption: curr - prev,
        notes: form.notes || undefined,
      };
      try {
        const url = editing ? `/api/meter-readings/${editing._id}` : "/api/meter-readings";
        const method = editing ? "PATCH" : "POST";
        const r = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok) { toast.error(d.error || "Failed to save"); return; }
      } catch {
        await new Promise((res) => setTimeout(res, 1000));
      }
      toast.success(editing ? "Meter reading updated" : "Meter reading added");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "_id",
      label: "No",
      render: (_, __, idx) => `MR-${((page - 1) * 20) + idx + 1}`,
      className: "w-20",
    },
    { key: "meterId", label: "Meter ID" },
    {
      key: "unitId",
      label: "Unit",
      render: (v) => (v as { unitCode?: string })?.unitCode ?? "",
    },
    {
      key: "customerId",
      label: "Customer",
      render: (v) => (v as { name?: string })?.name ?? "",
    },
    {
      key: "previousReading",
      label: "Previous",
      render: (v) => (v !== undefined && v !== null ? String(v) : "—"),
    },
    {
      key: "currentReading",
      label: "Current",
      render: (v) => (v !== undefined && v !== null ? String(v) : "—"),
    },
    {
      key: "consumption",
      label: "Consumption",
      render: (v) => <Badge variant="secondary">{v !== undefined && v !== null ? `${String(v)} units` : "—"}</Badge>,
    },
    {
      key: "readingDate",
      label: "Reading Date",
      render: (v) => formatDate(v as string),
    },
    {
      key: "billingMonth",
      label: "Billing Period",
      render: (v, row) => {
        const year = (row as unknown as MeterReading).billingYear;
        return `${v || "—"}${year ? ` ${year}` : ""}`;
      },
    },
    {
      key: "_id",
      label: "",
      render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as MeterReading)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Meter Readings" description="Record and manage utility meter readings">
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Reading
        </Button>
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
        searchPlaceholder="Search meter readings..."
        emptyMessage="No meter readings found."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Meter Reading" : "Add Meter Reading"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Basic Info</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="mr-meter" className="text-xs font-medium text-slate-600">
                    Meter ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mr-meter"
                    value={form.meterId}
                    onChange={(e) => setForm((f) => ({ ...f, meterId: e.target.value }))}
                    placeholder="MTR-0001"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mr-date" className="text-xs font-medium text-slate-600">
                    Reading Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mr-date"
                    type="date"
                    value={form.readingDate}
                    onChange={(e) => setForm((f) => ({ ...f, readingDate: e.target.value }))}
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mr-month" className="text-xs font-medium text-slate-600">
                    Billing Month
                  </Label>
                  <Select
                    value={form.billingMonth}
                    onValueChange={(v) => setForm((f) => ({ ...f, billingMonth: v }))}
                  >
                    <SelectTrigger
                      id="mr-month"
                      className="mt-1 h-10 border-slate-200 bg-slate-50/50 text-sm transition-all focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                    >
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="mr-year" className="text-xs font-medium text-slate-600">
                    Billing Year
                  </Label>
                  <Input
                    id="mr-year"
                    type="number"
                    value={form.billingYear}
                    onChange={(e) => setForm((f) => ({ ...f, billingYear: e.target.value }))}
                    placeholder="2025"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                  <BarChart className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Readings</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mr-prev" className="text-xs font-medium text-slate-600">
                    Previous Reading <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mr-prev"
                    type="number"
                    value={form.previousReading}
                    onChange={(e) => setForm((f) => ({ ...f, previousReading: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mr-curr" className="text-xs font-medium text-slate-600">
                    Current Reading <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="mr-curr"
                    type="number"
                    value={form.currentReading}
                    onChange={(e) => setForm((f) => ({ ...f, currentReading: e.target.value }))}
                    placeholder="0"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 italic">{consumptionHint}</p>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="mr-notes" className="text-xs font-medium text-slate-600">
                    Notes
                  </Label>
                  <Textarea
                    id="mr-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                    className="border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-9 border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={handleSave}
              className="h-9 px-5 text-sm font-medium shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
            >
              {editing ? "Update Reading" : "Save Reading"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
