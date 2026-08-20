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
import {
  Plus,
  Pencil,
  Eye,
  Trash2,
  User,
  MapPin,
  CreditCard,
  Layers,
  Phone,
  Mail,
  Building2,
  FileText,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface CustomerService {
  type: string;
  rate: number;
  units: number;
  description?: string;
}

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  state?: string;
  city?: string;
  pincode?: string;
  notes?: string;
  isActive: boolean;
  clientType?: "regular" | "premium";
  billingType?: "monthly" | "quarterly" | "yearly";
  billingLocationId?: string;
  services?: CustomerService[];
  createdAt?: string;
}

interface LocationOption {
  _id: string;
  name: string;
  locationId?: string;
}

const emptyForm = {
  name: "",
  mobile: "",
  email: "",
  address: "",
  gstin: "",
  pan: "",
  state: "",
  city: "",
  pincode: "",
  notes: "",
  clientType: "regular",
  billingType: "monthly",
  billingLocationId: "",
  services: [] as CustomerService[],
};

const serviceTypes = [
  { value: "security", label: "Security" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "maintenance", label: "Maintenance" },
  { value: "others", label: "Others" },
];

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [open, setOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/customers?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`
      );
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Load locations for dropdown
  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await fetch("/api/locations?limit=100");
        const json = await res.json();
        if (json.data) {
          setLocations(json.data);
        }
      } catch {
        // ignore error silently
      }
    }
    loadLocations();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name || "",
      mobile: c.mobile || "",
      email: c.email || "",
      address: c.address || "",
      gstin: c.gstin || "",
      pan: c.pan || "",
      state: c.state || "",
      city: c.city || "",
      pincode: c.pincode || "",
      notes: c.notes || "",
      clientType: c.clientType || "regular",
      billingType: c.billingType || "monthly",
      billingLocationId: c.billingLocationId || "",
      services: Array.isArray(c.services) ? c.services : [],
    });
    setOpen(true);
  }

  function handleView(c: Customer) {
    setViewCustomer(c);
    setViewOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Client Name is required");
      return;
    }
    if (!form.mobile.trim() || form.mobile.trim().length < 10) {
      toast.error("Valid 10-digit mobile number is required");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/customers/${editing._id}` : "/api/customers";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to save client");
        return;
      }
      toast.success(editing ? "Client updated successfully" : "Client added successfully");
      setOpen(false);
      load();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const addServiceRow = () => {
    setForm((prev) => ({
      ...prev,
      services: [
        ...prev.services,
        { type: "maintenance", rate: 0, units: 1, description: "" },
      ],
    }));
  };

  const handleServiceChange = (
    index: number,
    field: keyof CustomerService,
    value: string | number
  ) => {
    setForm((prev) => {
      const services = [...prev.services];
      services[index] = { ...services[index], [field]: value };
      return { ...prev, services };
    });
  };

  const handleServiceRemove = (index: number) => {
    setForm((prev) => {
      const services = [...prev.services];
      services.splice(index, 1);
      return { ...prev, services };
    });
  };

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "customerId",
      label: "Client ID",
      className: "w-28 font-mono font-medium text-xs text-slate-700",
    },
    {
      key: "name",
      label: "Name",
      render: (v, row) => (
        <div>
          <div className="font-semibold text-slate-900">{String(v || "-")}</div>
          {Boolean(row.email) && (
            <div className="text-xs text-slate-500">{String(row.email)}</div>
          )}
        </div>
      ),
    },
    { key: "mobile", label: "Mobile" },
    {
      key: "city",
      label: "Location",
      render: (v, row) => (
        <span className="text-slate-600">
          {[v, row.state].filter(Boolean).join(", ") || "-"}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (v) => (
        <Badge variant={v ? "success" : "muted"}>
          {v ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "_id",
      label: "Actions",
      className: "w-24 text-right",
      render: (_, row) => {
        const item = row as unknown as Customer;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="View Details"
              onClick={() => handleView(item)}
            >
              <Eye className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit Client"
              onClick={() => openEdit(item)}
            >
              <Pencil className="h-4 w-4 text-primary" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients / Parties"
        description="Manage customer profiles, billing preferences, and assigned services"
      >
        <Button onClick={openAdd} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Client
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
        searchPlaceholder="Search by name, mobile, email, client ID..."
        emptyMessage="No clients found."
      />

      {/* Add / Edit Client Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
          {/* Fixed Header */}
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {editing ? `Edit Client: ${editing.name}` : "Add New Client"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Fill in customer profile information and billing details below.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-white">
            {/* Section 1: Basic Information */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <User className="h-4 w-4 text-primary" />
                <span>Basic Information</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Client / Party Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    className="mt-1.5 bg-white"
                    placeholder="e.g. John Doe / Apex Corp"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Mobile Number <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    className="mt-1.5 bg-white"
                    placeholder="10-digit mobile number"
                    value={form.mobile}
                    onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    className="mt-1.5 bg-white"
                    type="email"
                    placeholder="client@example.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    GSTIN
                  </Label>
                  <Input
                    className="mt-1.5 bg-white uppercase font-mono"
                    placeholder="e.g. 07AAAAA0000A1Z5"
                    value={form.gstin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">PAN</Label>
                  <Input
                    className="mt-1.5 bg-white uppercase font-mono"
                    placeholder="e.g. ABCDE1234F"
                    value={form.pan}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Notes / Remarks
                  </Label>
                  <Input
                    className="mt-1.5 bg-white"
                    placeholder="Additional details..."
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Address Details */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                <span>Address Details</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <Label className="text-xs font-semibold text-slate-700">
                    Street Address
                  </Label>
                  <Textarea
                    className="mt-1.5 bg-white resize-none"
                    rows={2}
                    placeholder="Flat / Building, Road, Area..."
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">City</Label>
                  <Input
                    className="mt-1.5 bg-white"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">State</Label>
                  <Input
                    className="mt-1.5 bg-white"
                    placeholder="State"
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Pincode
                  </Label>
                  <Input
                    className="mt-1.5 bg-white"
                    placeholder="6-digit Pincode"
                    value={form.pincode}
                    onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Billing Preferences */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span>Billing & Preferences</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Client Type
                  </Label>
                  <div className="flex gap-4 items-center mt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="clientType"
                        value="regular"
                        checked={form.clientType === "regular"}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, clientType: e.target.value }))
                        }
                        className="accent-primary h-4 w-4"
                      />
                      <span>Regular</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="clientType"
                        value="premium"
                        checked={form.clientType === "premium"}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, clientType: e.target.value }))
                        }
                        className="accent-primary h-4 w-4"
                      />
                      <span>Premium</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Billing Location
                  </Label>
                  <select
                    value={form.billingLocationId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, billingLocationId: e.target.value }))
                    }
                    className="w-full h-10 border border-slate-200 rounded-md px-3 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">-- Select Billing Location --</option>
                    {locations.map((loc) => (
                      <option key={loc._id} value={loc._id}>
                        {loc.name} {loc.locationId ? `(${loc.locationId})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Billing Frequency
                  </Label>
                  <div className="flex flex-wrap gap-4 items-center mt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                    {["monthly", "quarterly", "yearly"].map((freq) => (
                      <label
                        key={freq}
                        className="flex items-center gap-2 text-sm text-slate-700 capitalize cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="billingType"
                          value={freq}
                          checked={form.billingType === freq}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, billingType: e.target.value }))
                          }
                          className="accent-primary h-4 w-4"
                        />
                        <span>{freq}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Assigned Services */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                  <Layers className="h-4 w-4 text-amber-600" />
                  <span>Assigned Services</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addServiceRow}
                  className="h-7 text-xs bg-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Service Row
                </Button>
              </div>

              {form.services.length === 0 ? (
                <div className="text-center py-6 border border-dashed rounded-lg border-slate-300 bg-white">
                  <Layers className="h-8 w-8 mx-auto text-slate-300 mb-1" />
                  <p className="text-xs text-slate-500">
                    No services assigned yet. Click below to add.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addServiceRow}
                    className="mt-2 text-xs text-primary font-medium"
                  >
                    + Add First Service
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.services.map((service, index) => (
                    <div
                      key={index}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600">
                          Service #{index + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => handleServiceRemove(index)}
                          title="Remove service"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs text-slate-600">Service Type</Label>
                          <select
                            value={service.type}
                            onChange={(e) =>
                              handleServiceChange(index, "type", e.target.value)
                            }
                            className="mt-1 w-full h-9 border border-slate-200 rounded-md px-2.5 text-xs bg-white focus:ring-2 focus:ring-primary/20"
                          >
                            {serviceTypes.map((st) => (
                              <option key={st.value} value={st.value}>
                                {st.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Rate (₹)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            className="mt-1 h-9 text-xs"
                            value={service.rate}
                            onChange={(e) =>
                              handleServiceChange(
                                index,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Units</Label>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            className="mt-1 h-9 text-xs"
                            value={service.units}
                            onChange={(e) =>
                              handleServiceChange(
                                index,
                                "units",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-slate-600">
                          Description / Note (Optional)
                        </Label>
                        <Input
                          className="mt-1 h-9 text-xs"
                          placeholder="e.g. 24/7 Security guard deployment"
                          value={service.description || ""}
                          onChange={(e) =>
                            handleServiceChange(index, "description", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer with Visible Buttons */}
          <DialogFooter className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-4"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="px-5 shadow-xs"
              loading={saving}
              onClick={handleSave}
            >
              {editing ? "Update Client" : "Save Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Client Details Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    {viewCustomer?.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-mono text-slate-500">
                    {viewCustomer?.customerId}
                  </DialogDescription>
                </div>
              </div>
              <Badge variant={viewCustomer?.isActive ? "success" : "muted"}>
                {viewCustomer?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm bg-white">
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-xs text-slate-400 block">Mobile</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {viewCustomer?.mobile || "-"}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Email</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {viewCustomer?.email || "-"}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">GSTIN</span>
                <span className="font-mono font-medium text-slate-800 mt-0.5 block">
                  {viewCustomer?.gstin || "-"}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">PAN</span>
                <span className="font-mono font-medium text-slate-800 mt-0.5 block">
                  {viewCustomer?.pan || "-"}
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Address
              </span>
              <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs leading-relaxed">
                {[
                  viewCustomer?.address,
                  viewCustomer?.city,
                  viewCustomer?.state,
                  viewCustomer?.pincode,
                ]
                  .filter(Boolean)
                  .join(", ") || "No address provided"}
              </p>
            </div>

            {Boolean(viewCustomer?.notes) && (
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Notes
                </span>
                <p className="text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                  {viewCustomer?.notes}
                </p>
              </div>
            )}

            {Array.isArray(viewCustomer?.services) &&
              viewCustomer.services.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-2">
                    Assigned Services ({viewCustomer.services.length})
                  </span>
                  <div className="space-y-2">
                    {viewCustomer.services.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {s.type}
                          </Badge>
                          {s.description && (
                            <span className="text-slate-600">{s.description}</span>
                          )}
                        </div>
                        <span className="font-semibold text-slate-800">
                          ₹{s.rate} × {s.units}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <DialogFooter className="px-6 py-3 border-t border-slate-200 bg-slate-50/90 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setViewOpen(false);
                if (viewCustomer) openEdit(viewCustomer);
              }}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
