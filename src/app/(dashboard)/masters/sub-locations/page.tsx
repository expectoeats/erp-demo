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
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

interface SubLoc {
  _id: string;
  subLocationId: string;
  name: string;
  code?: string;
  locationId: { _id: string; name: string };
  isActive: boolean;
}

interface Location { _id: string; name: string; locationId: string; }

export default function SubLocationsPage() {
  const [data, setData] = useState<SubLoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SubLoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", locationId: "", address: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/sub-locations?search=${encodeURIComponent(search)}&page=${page}`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/locations?limit=100").then((r) => r.json()).then((d) => setLocations(d.data ?? []));
  }, []);

  async function handleSave() {
    if (!form.name || !form.locationId) { toast.error("Name and location required"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/sub-locations/${editing._id}` : "/api/sub-locations";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success("Saved");
      setOpen(false);
      load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "subLocationId", label: "ID", className: "w-28" },
    { key: "name", label: "Name" },
    { key: "code", label: "Code" },
    { key: "locationId", label: "Location", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "isActive", label: "Status", render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge> },
    { key: "_id", label: "", render: (_, row) => <Button variant="ghost" size="icon-sm" onClick={() => { setEditing(row as unknown as SubLoc); setForm({ name: (row as unknown as SubLoc).name, code: (row as unknown as SubLoc).code ?? "", locationId: (row as unknown as SubLoc).locationId._id, address: "" }); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button> },
  ];

  return (
    <div>
      <PageHeader title="Sub Locations" description="Phases, zones, or areas within a location">
        <Button size="sm" onClick={() => { setEditing(null); setForm({ name: "", code: "", locationId: "", address: "" }); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Sub Location
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={total} page={page} pageSize={20} onPageChange={setPage} searchValue={search} onSearchChange={setSearch} emptyMessage="No sub-locations yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Sub Location</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <Label>Location *</Label>
              <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name *</Label>
              <Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Phase 1" />
            </div>
            <div>
              <Label>Code</Label>
              <Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. P1" />
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
