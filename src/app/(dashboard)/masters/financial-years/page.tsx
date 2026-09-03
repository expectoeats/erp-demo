"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
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
  const [data, setData] = useState<FY[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FY | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", isActive: false });

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch("/api/financial-years", { signal });
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

  function openAdd() {
    setEditing(null);
    setForm({ name: "", startDate: "", endDate: "", isActive: false });
    setOpen(true);
  }

  function openEdit(fy: FY) {
    setEditing(fy);
    setForm({
      name: fy.name,
      startDate: fy.startDate.split("T")[0],
      endDate: fy.endDate.split("T")[0],
      isActive: fy.isActive,
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.startDate || !form.endDate) {
      toast.error("All fields are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/financial-years/${editing._id}` : "/api/financial-years";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(editing ? "Updated" : "Created");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Name" },
    { key: "startDate", label: "Start Date", render: (v) => formatDate(v as string) },
    { key: "endDate", label: "End Date", render: (v) => formatDate(v as string) },
    {
      key: "isActive", label: "Status", render: (_, row) => (
        <div className="flex gap-1.5">
          {(row.isActive as boolean) && <Badge variant="success">Active</Badge>}
          {(row.isClosed as boolean) && <Badge variant="muted">Closed</Badge>}
          {!(row.isActive as boolean) && !(row.isClosed as boolean) && <Badge variant="secondary">Inactive</Badge>}
        </div>
      )
    },
    {
      key: "_id", label: "", render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as FY)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Financial Years" description="Manage billing sessions and financial years">
        <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Year</Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={data.length}
        emptyMessage="No financial years. Add one to start billing."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Financial Year" : "Add Financial Year"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Name (e.g. 2026-27)</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="2026-27" />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input className="mt-1" type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input className="mt-1" type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Set as Active Year</Label>
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
