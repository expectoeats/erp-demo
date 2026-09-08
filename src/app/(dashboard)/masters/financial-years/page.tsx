"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  CalendarDays,
  CheckCircle2,
  Lock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface FY {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  isClosed: boolean;
}

export default function FinancialYearsPage() {
  const [data, setData]       = useState<FY[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<FY | null>(null);
  const [saving, setSaving]   = useState(false);
  const [form, setForm]       = useState({
    name: "", startDate: "", endDate: "", isActive: false,
  });

  // ── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    const attempt = async (): Promise<boolean> => {
      try {
        const r = await fetch("/api/financial-years", { signal });
        if (!r.ok) return false;
        const d = await r.json();
        setData(d.data ?? []);
        return true;
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        return false;
      }
    };
    try {
      const ok = await attempt();
      if (!ok) {
        for (const delay of [1500, 3000]) {
          await new Promise((res) => setTimeout(res, delay));
          const retried = await attempt();
          if (retried) return;
        }
        setData([]);
      }
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

  // ── Dialogs ───────────────────────────────────────────────────────────────
  function openAdd() {
    setEditing(null);
    setForm({ name: "", startDate: "", endDate: "", isActive: false });
    setOpen(true);
  }

  function openEdit(fy: FY) {
    setEditing(fy);
    setForm({
      name:      fy.name,
      startDate: fy.startDate.split("T")[0],
      endDate:   fy.endDate.split("T")[0],
      isActive:  fy.isActive,
    });
    setOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim())  { toast.error("Name is required");       return; }
    if (!form.startDate)    { toast.error("Start date is required"); return; }
    if (!form.endDate)      { toast.error("End date is required");   return; }
    if (form.startDate >= form.endDate) {
      toast.error("End date must be after start date");
      return;
    }
    setSaving(true);
    try {
      const url    = editing ? `/api/financial-years/${editing._id}` : "/api/financial-years";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Failed to save"); return; }
      toast.success(editing ? "Financial year updated" : "Financial year created");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  // ── Quick set active ──────────────────────────────────────────────────────
  async function handleSetActive(fy: FY) {
    if (fy.isActive) return;
    if (fy.isClosed) { toast.error("Cannot activate a closed financial year"); return; }
    try {
      const r = await fetch(`/api/financial-years/${fy._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error ?? "Failed to activate"); return; }
      toast.success(`${fy.name} is now the active financial year`);
      load();
    } catch {
      toast.error("Something went wrong");
    }
  }

  // ── Status badge ──────────────────────────────────────────────────────────
  function StatusBadge({ fy }: { fy: FY }) {
    if (fy.isActive)  return <Badge variant="success">Active</Badge>;
    if (fy.isClosed)  return <Badge variant="muted" className="flex items-center gap-1"><Lock className="h-2.5 w-2.5"/>Closed</Badge>;
    return <Badge variant="secondary">Inactive</Badge>;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Financial Years" description="Manage billing sessions and financial years">
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Year
        </Button>
      </PageHeader>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_100px] bg-muted/30 border-b border-slate-200 px-5 py-2.5">
          {["Name", "Start Date", "End Date", "Status", ""].map((h) => (
            <span key={h} className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="divide-y divide-slate-100">
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid grid-cols-[2fr_1.5fr_1.5fr_1fr_100px] px-5 py-4 items-center gap-3">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className={`h-3.5 rounded bg-slate-100 animate-pulse ${j === 0 ? "w-3/4" : j === 4 ? "w-8 ml-auto" : "w-2/3"}`} />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarDays className="h-9 w-9 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500 mb-0.5">No financial years yet</p>
            <p className="text-xs text-slate-400 mb-4">Add a financial year to start billing</p>
            <Button size="sm" variant="outline" onClick={openAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add First Year
            </Button>
          </div>
        )}

        {/* Rows */}
        {!loading && data.length > 0 && (
          <div className="divide-y divide-slate-100">
            {data.map((fy) => (
              <div
                key={fy._id}
                className={`grid grid-cols-[2fr_1.5fr_1.5fr_1fr_100px] px-5 py-3.5 items-center gap-3 transition-colors hover:bg-slate-50/60
                  ${fy.isActive ? "bg-emerald-50/40" : ""}`}
              >
                {/* Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {fy.isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <span className={`text-sm font-semibold truncate ${fy.isActive ? "text-emerald-800" : "text-slate-800"}`}>
                    {fy.name}
                  </span>
                </div>

                {/* Start Date */}
                <span className="text-xs text-slate-600">{formatDate(fy.startDate)}</span>

                {/* End Date */}
                <span className="text-xs text-slate-600">{formatDate(fy.endDate)}</span>

                {/* Status */}
                <StatusBadge fy={fy} />

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5">
                  {!fy.isActive && !fy.isClosed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2.5 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold"
                      onClick={() => handleSetActive(fy)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Set Active
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-slate-400 hover:text-slate-700"
                    onClick={() => openEdit(fy)}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog ────────────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden">

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {editing ? "Edit Financial Year" : "Add Financial Year"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  {editing
                    ? "Update the details for this financial year."
                    : "Create a new financial year for billing."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="px-6 py-5 space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Financial Year Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. 2026-27"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-10"
              />
              <p className="text-[11px] text-slate-400">Format: YYYY-YY &nbsp;(e.g. 2026-27)</p>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  End Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>

            {/* Set as Active toggle */}
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all text-left
                ${form.isActive
                  ? "border-emerald-400 bg-emerald-50/60"
                  : "border-slate-200 bg-white hover:border-slate-300"
                }`}
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-4 w-4 shrink-0 ${form.isActive ? "text-emerald-600" : "text-slate-300"}`} />
                <div>
                  <p className={`text-sm font-semibold ${form.isActive ? "text-emerald-800" : "text-slate-700"}`}>
                    Set as Active Year
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {form.isActive
                      ? "This will be the active billing period"
                      : "Make this the current billing year"}
                  </p>
                </div>
              </div>
              {/* Toggle pill */}
              <div className={`relative flex-shrink-0 h-5 w-9 rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-slate-300"}`}>
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${form.isActive ? "left-4" : "left-0.5"}`}
                />
              </div>
            </button>

            {form.isActive && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  This will automatically deactivate any currently active financial year.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="min-w-[100px]">
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</>
              ) : (
                editing ? "Update Year" : "Create Year"
              )}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </div>
  );
}
