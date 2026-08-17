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
import { Plus, Pencil, MapPin, Building2, FileText, Hash } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface Location {
  _id: string;
  locationId: string;
  name: string;
  city?: string;
  state?: string;
  gstin?: string;
  isActive: boolean;
}

const empty = { name: "", address: "", state: "", city: "", pincode: "", gstin: "", gstConfig: "" };

export default function LocationsPage() {
  const [data, setData] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/locations?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({ name: loc.name, address: "", state: loc.state ?? "", city: loc.city ?? "", pincode: "", gstin: loc.gstin ?? "", gstConfig: "" });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/locations/${editing._id}` : "/api/locations";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(editing ? "Location updated" : "Location added");
      setOpen(false);
      load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "locationId", label: "ID", className: "w-24" },
    { key: "name", label: "Name" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "gstin", label: "GSTIN" },
    {
      key: "isActive", label: "Status",
      render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge>
    },
    {
      key: "_id", label: "",
      render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as Location)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Locations" description="Manage your property locations">
        <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Location</Button>
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
        searchPlaceholder="Search locations..."
        emptyMessage="No locations yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Location" : "Add Location"}</DialogTitle>
            <p className="text-sm text-slate-500">
              {editing ? "Update the existing location details below." : "Enter the details to create a new property location."}
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
              <div className="space-y-1.5">
                <Label htmlFor="loc-name" className="text-xs font-medium text-slate-600">
                  Location Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="loc-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Jaipur Warehouse"
                  className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Location Details</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="loc-city" className="text-xs font-medium text-slate-600">City</Label>
                  <Input
                    id="loc-city"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Jaipur"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-state" className="text-xs font-medium text-slate-600">State</Label>
                  <Input
                    id="loc-state"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    placeholder="e.g. Rajasthan"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-pincode" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" /> Pincode</span>
                  </Label>
                  <Input
                    id="loc-pincode"
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                    placeholder="e.g. 302001"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc-gstin" className="text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> GSTIN</span>
                  </Label>
                  <Input
                    id="loc-gstin"
                    value={form.gstin}
                    onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                    placeholder="e.g. 08AAABC1234D1Z5"
                    className="h-10 border-slate-200 bg-slate-50/50 font-mono text-xs uppercase tracking-wider transition-all placeholder:text-slate-400 placeholder:normal-case placeholder:tracking-normal focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Full Address</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc-address" className="text-xs font-medium text-slate-600">Street Address</Label>
                <Textarea
                  id="loc-address"
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Building no., Street name, Area, Landmark..."
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
              {editing ? "Update Location" : "Save Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
