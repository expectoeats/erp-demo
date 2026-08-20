"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, MapPin, Building2, FileText, Hash, Landmark } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface Location {
  _id: string;
  locationId: string;
  name: string;
  city?: string;
  state?: string;
  gstin?: string;
  isActive: boolean;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
}

const empty = {
  name: "",
  address: "",
  state: "",
  city: "",
  pincode: "",
  gstin: "",
  gstConfig: "",
  bankName: "",
  accountNumber: "",
  ifscCode: "",
};

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
    try {
      const r = await fetch(
        `/api/locations?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`
      );
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      toast.error("Failed to load locations");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({
      name: loc.name || "",
      address: "",
      state: loc.state ?? "",
      city: loc.city ?? "",
      pincode: "",
      gstin: loc.gstin ?? "",
      gstConfig: "",
      bankName: loc.bankName ?? "",
      accountNumber: loc.accountNumber ?? "",
      ifscCode: loc.ifscCode ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Company Name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/locations/${editing._id}` : "/api/locations";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to save location");
        return;
      }
      toast.success(editing ? "Location updated" : "Location added");
      setOpen(false);
      load();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "locationId", label: "ID", className: "w-24 font-mono font-medium text-xs text-slate-700" },
    { key: "name", label: "Name", className: "font-semibold text-slate-900" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "gstin", label: "GSTIN", className: "font-mono text-xs uppercase" },
    {
      key: "isActive",
      label: "Status",
      render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "_id",
      label: "",
      className: "w-16 text-right",
      render: (_, row) => (
        <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as Location)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Locations" description="Manage your property locations and entities">
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Location
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
        searchPlaceholder="Search locations..."
        emptyMessage="No locations yet."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex flex-col max-h-[90vh] w-full max-w-xl p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {editing ? "Edit Location" : "Add Location"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  {editing ? "Update existing location details." : "Enter details for the new location entity."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-white">
            {/* Basic Information */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Basic Information</span>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Location / Company Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. ABC Residency / Sunrise Towers"
                  className="mt-1 bg-white"
                />
              </div>
            </div>

            {/* Geographical Details */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span>Address Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Full Address</Label>
                  <Textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Building no., Street name, Area, Landmark..."
                    className="mt-1 bg-white resize-none"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">City</Label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="e.g. Jaipur"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">State</Label>
                  <Input
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    placeholder="e.g. Rajasthan"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Pincode</Label>
                  <Input
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                    placeholder="e.g. 302001"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">GSTIN</Label>
                  <Input
                    value={form.gstin}
                    onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    placeholder="e.g. 08AAABC1234D1Z5"
                    className="mt-1 bg-white uppercase font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <Landmark className="h-4 w-4 text-blue-600" />
                <span>Bank Account Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700">Bank Name</Label>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                    placeholder="e.g. State Bank of India / HDFC Bank"
                    className="mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Account Number</Label>
                  <Input
                    value={form.accountNumber}
                    onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="e.g. 1234567890"
                    className="mt-1 bg-white font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">IFSC Code</Label>
                  <Input
                    value={form.ifscCode}
                    onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                    placeholder="e.g. SBIN0001234"
                    className="mt-1 bg-white font-mono uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              {editing ? "Update Location" : "Save Location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
