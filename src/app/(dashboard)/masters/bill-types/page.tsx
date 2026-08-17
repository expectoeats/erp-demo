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
import { Plus } from "lucide-react";

interface BillType { _id: string; name: string; code: string; prefix: string; lastNumber: number; isActive: boolean; }

export default function BillTypesPage() {
  const [data, setData] = useState<BillType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", prefix: "", description: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/bill-types");
    const d = await r.json();
    setData(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.name || !form.code || !form.prefix) { toast.error("Name, code and prefix required"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/bill-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success("Bill type created");
      setOpen(false);
      setForm({ name: "", code: "", prefix: "", description: "" });
      load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "prefix", label: "Prefix" },
    { key: "lastNumber", label: "Last No." },
    { key: "isActive", label: "Status", render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Bill Types" description="Configure bill numbering series">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Bill Type</Button>
      </PageHeader>
      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={data.length} emptyMessage="No bill types. Add one to start generating bills." />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Bill Type</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div><Label>Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Monthly Rent" /></div>
            <div><Label>Code *</Label><Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="RENT" /></div>
            <div><Label>Prefix *</Label><Input className="mt-1" value={form.prefix} onChange={(e) => setForm((f) => ({ ...f, prefix: e.target.value }))} placeholder="INV" /></div>
            <p className="text-xs text-muted-foreground">Invoice will be: {form.prefix || "INV"}/2026-27/000001</p>
            <div><Label>Description</Label><Textarea className="mt-1" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
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
