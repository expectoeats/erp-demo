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
import { Plus, Pencil, Eye } from "lucide-react";
import Link from "next/link";
import { useDebounce } from "@/hooks/use-debounce";

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  gstin?: string;
  isActive: boolean;
}

const empty = { name: "", mobile: "", email: "", address: "", gstin: "", pan: "", state: "", city: "", pincode: "", notes: "" };

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/customers?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditing(null); setForm(empty); setOpen(true); }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({ name: c.name, mobile: c.mobile, email: c.email ?? "", address: "", gstin: c.gstin ?? "", pan: "", state: "", city: c.city ?? "", pincode: "", notes: "" });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name || !form.mobile) { toast.error("Name and mobile required"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/customers/${editing._id}` : "/api/customers";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok) { toast.error(d.error); return; }
      toast.success(editing ? "Customer updated" : "Customer added");
      setOpen(false); load();
    } finally { setSaving(false); }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "customerId", label: "ID", className: "w-28" },
    { key: "name", label: "Name" },
    { key: "mobile", label: "Mobile" },
    { key: "email", label: "Email" },
    { key: "city", label: "City" },
    { key: "isActive", label: "Status", render: (v) => <Badge variant={v ? "success" : "muted"}>{v ? "Active" : "Inactive"}</Badge> },
    {
      key: "_id", label: "", render: (_, row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/masters/customers/${row._id}`}><Eye className="h-3.5 w-3.5" /></Link>
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(row as unknown as Customer)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Customers / Parties" description="Manage all customers and business parties">
        <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1" /> Add Customer</Button>
      </PageHeader>

      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={total} page={page} pageSize={20} onPageChange={setPage} searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search name, mobile, ID..." emptyMessage="No customers yet." />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Mobile *</Label><Input className="mt-1" value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></div>
            <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>City</Label><Input className="mt-1" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} /></div>
            <div><Label>State</Label><Input className="mt-1" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} /></div>
            <div><Label>Pincode</Label><Input className="mt-1" value={form.pincode} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} /></div>
            <div><Label>GSTIN</Label><Input className="mt-1" value={form.gstin} onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))} /></div>
            <div><Label>PAN</Label><Input className="mt-1" value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Address</Label><Textarea className="mt-1" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Notes</Label><Input className="mt-1" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
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
