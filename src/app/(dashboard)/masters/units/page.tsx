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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Eye } from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/use-debounce";

interface Unit {
  _id: string;
  unitId: string;
  unitCode: string;
  currentOwnerId: { name: string; customerId: string };
  locationId: { name: string };
  subLocationId: { name: string };
  area?: number;
  areaUnit?: string;
  status: string;
  rentRate?: number;
}

interface Location { _id: string; name: string; }
interface SubLocation { _id: string; name: string; }
interface Customer { _id: string; name: string; customerId: string; }
interface Service { _id: string; name: string; code: string; }

const statusColors: Record<string, "success" | "muted" | "warning" | "destructive"> = {
  active: "success", vacant: "warning", inactive: "muted", transferred: "destructive",
};

export default function UnitsPage() {
  const [data, setData] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [locations, setLocations] = useState<Location[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const [form, setForm] = useState({
    unitCode: "", currentOwnerId: "", locationId: "", subLocationId: "",
    propertyType: "", area: "", areaUnit: "sq.m", status: "active",
    rentRate: "", securityDeposit: "", notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/units?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/locations?limit=100").then((r) => r.json()).then((d) => setLocations(d.data ?? []));
    fetch("/api/customers?limit=200").then((r) => r.json()).then((d) => setCustomers(d.data ?? []));
    fetch("/api/services?active=true").then((r) => r.json()).then((d) => setServices(d.data ?? []));
  }, []);

  useEffect(() => {
    if (form.locationId) {
      fetch(`/api/sub-locations?locationId=${form.locationId}&limit=100`)
        .then((r) => r.json()).then((d) => setSubLocations(d.data ?? []));
    }
  }, [form.locationId]);

  function resetForm() {
    setForm({ unitCode: "", currentOwnerId: "", locationId: "", subLocationId: "", propertyType: "", area: "", areaUnit: "sq.m", status: "active", rentRate: "", securityDeposit: "", notes: "" });
    setSelectedServices([]);
  }

  async function handleSave() {
    if (!form.unitCode || !form.currentOwnerId || !form.locationId || !form.subLocationId) {
      toast.error("Unit code, customer, location and sub-location are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        area: form.area ? parseFloat(form.area) : undefined,
        rentRate: form.rentRate ? parseFloat(form.rentRate) : undefined,
        securityDeposit: form.securityDeposit ? parseFloat(form.securityDeposit) : undefined,
        services: selectedServices,
      };
      const url = editing ? `/api/units/${editing._id}` : "/api/units";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success("Saved");
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "unitId", label: "Unit ID", className: "w-32" },
    { key: "unitCode", label: "Code" },
    { key: "currentOwnerId", label: "Owner", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "locationId", label: "Location", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "subLocationId", label: "Sub Location", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "area", label: "Area", render: (v, row) => v ? `${v} ${row.areaUnit ?? "sq.m"}` : "—" },
    { key: "status", label: "Status", render: (v) => <Badge variant={statusColors[v as string] ?? "secondary"}>{String(v)}</Badge> },
    {
      key: "_id", label: "", render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/masters/units/${row._id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => {
            const u = row as unknown as Unit;
            setEditing(u);
            setForm({ unitCode: u.unitCode, currentOwnerId: (u.currentOwnerId as unknown as { _id: string })?._id ?? "", locationId: (u.locationId as unknown as { _id: string })?._id ?? "", subLocationId: (u.subLocationId as unknown as { _id: string })?._id ?? "", propertyType: "", area: String(u.area ?? ""), areaUnit: u.areaUnit ?? "sq.m", status: u.status, rentRate: String(u.rentRate ?? ""), securityDeposit: "", notes: "" });
            setOpen(true);
          }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Units / Properties" description="Manage all properties and units">
        <Button size="sm" onClick={() => { setEditing(null); resetForm(); setOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Unit
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={total} page={page} pageSize={20} onPageChange={setPage} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by code or ID..." emptyMessage="No units yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Unit" : "Add Unit"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Unit Code *</Label><Input className="mt-1" value={form.unitCode} onChange={(e) => setForm((f) => ({ ...f, unitCode: e.target.value }))} placeholder="JPR-P1-001" /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Customer / Owner *</Label>
              <Select value={form.currentOwnerId} onValueChange={(v) => setForm((f) => ({ ...f, currentOwnerId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c._id} value={c._id}>{c.name} ({c.customerId})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Location *</Label>
              <Select value={form.locationId} onValueChange={(v) => setForm((f) => ({ ...f, locationId: v, subLocationId: "" }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l._id} value={l._id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sub Location *</Label>
              <Select value={form.subLocationId} onValueChange={(v) => setForm((f) => ({ ...f, subLocationId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{subLocations.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Area</Label><Input className="mt-1" type="number" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="500" /></div>
            <div>
              <Label>Area Unit</Label>
              <Select value={form.areaUnit} onValueChange={(v) => setForm((f) => ({ ...f, areaUnit: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sq.m">sq.m</SelectItem>
                  <SelectItem value="sq.ft">sq.ft</SelectItem>
                  <SelectItem value="acre">acre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Rent Rate (per unit)</Label><Input className="mt-1" type="number" value={form.rentRate} onChange={(e) => setForm((f) => ({ ...f, rentRate: e.target.value }))} placeholder="5" /></div>
            <div><Label>Security Deposit</Label><Input className="mt-1" type="number" value={form.securityDeposit} onChange={(e) => setForm((f) => ({ ...f, securityDeposit: e.target.value }))} /></div>
            <div className="col-span-2">
              <Label>Applicable Services</Label>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {services.map((s) => (
                  <label key={s._id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={selectedServices.includes(s._id)}
                      onCheckedChange={(v) => {
                        setSelectedServices((prev) =>
                          v ? [...prev, s._id] : prev.filter((id) => id !== s._id)
                        );
                      }}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
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
