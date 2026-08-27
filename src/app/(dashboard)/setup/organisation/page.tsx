"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Star,
  Phone,
  Mail,
  CreditCard,
  Layers,
  Sparkles,
  Building,
  Globe,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface LocationRef {
  _id: string;
  name: string;
  locationId?: string;
  city?: string;
  state?: string;
  gstin?: string;
  address?: string;
  pincode?: string;
}

interface OrgSettingsData {
  _id: string;
  companyName: string;
  orgCode?: string;
  locationId?: string | LocationRef;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankDetails?: string;
  invoiceFooter?: string;
  invoicePrefix: string;
  receiptPrefix: string;
  voucherPrefix: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt?: string;
}



const emptyForm = {
  companyName: "",
  orgCode: "",
  phone: "",
  email: "",
  website: "",
  gstin: "",
  pan: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  invoicePrefix: "INV",
  receiptPrefix: "RCT",
  voucherPrefix: "VCH",
  invoiceFooter: "Thank you for your business!",
  bankDetails: "",
};

export default function OrganisationSetupPage() {
  const [data, setData] = useState<OrgSettingsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OrgSettingsData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/settings/organisation");
      const d = await r.json();
      setData(d.data ?? []);
    } catch {
      toast.error("Failed to load organisation profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(org: OrgSettingsData) {
    setEditing(org);
    setForm({
      companyName: org.companyName || "",
      orgCode: org.orgCode || "",
      phone: org.phone || "",
      email: org.email || "",
      website: org.website || "",
      gstin: org.gstin || "",
      pan: org.pan || "",
      address: org.address || "",
      city: org.city || "",
      state: org.state || "",
      pincode: org.pincode || "",
      invoicePrefix: org.invoicePrefix || "INV",
      receiptPrefix: org.receiptPrefix || "RCT",
      voucherPrefix: org.voucherPrefix || "VCH",
      invoiceFooter: org.invoiceFooter || "",
      bankDetails: org.bankDetails || "",
    });
    setOpen(true);
  }

  async function handleSetDefault(org: OrgSettingsData) {
    try {
      const r = await fetch(`/api/settings/organisation/${org._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to set default organisation");
        return;
      }
      toast.success(`${org.companyName} set as Primary Organisation`);
      load();
    } catch {
      toast.error("Something went wrong");
    }
  }

  async function handleDelete(org: OrgSettingsData) {
    if (
      !confirm(
        `Are you sure you want to deactivate organisation profile '${org.companyName}'?`
      )
    ) {
      return;
    }

    try {
      const r = await fetch(`/api/settings/organisation/${org._id}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to delete organisation");
        return;
      }
      toast.success("Organisation deactivated successfully");
      load();
    } catch {
      toast.error("Something went wrong");
    }
  }

  async function handleSave() {
    if (!form.companyName.trim()) {
      toast.error("Company / Organisation Name is required");
      return;
    }

    setSaving(true);
    try {
      const url = editing
        ? `/api/settings/organisation/${editing._id}`
        : "/api/settings/organisation";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to save organisation");
        return;
      }
      toast.success(
        editing
          ? "Organisation profile updated successfully"
          : "Organisation profile created successfully"
      );
      setOpen(false);
      load();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const defaultOrg = data.find((d) => d.isDefault && d.isActive) || data[0];

  const filteredData = data.filter((item) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      item.companyName.toLowerCase().includes(q) ||
      (item.orgCode || "").toLowerCase().includes(q) ||
      (item.city || "").toLowerCase().includes(q)
    );
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "companyName",
      label: "Company / Branch",
      className: "min-w-[230px]",
      render: (v, row) => {
        const item = row as unknown as OrgSettingsData;
        return (
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span>{String(v)}</span>
              {item.isDefault && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4">
                  Primary
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
              {item.orgCode && <span>Code: {item.orgCode}</span>}
              {item.gstin && <span>• GST: {item.gstin}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: "phone",
      label: "Contact Details",
      className: "min-w-[160px]",
      render: (_, row) => {
        const item = row as unknown as OrgSettingsData;
        return (
          <div className="text-xs space-y-0.5">
            {item.phone && (
              <div className="text-slate-700 flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400" />
                <span>{item.phone}</span>
              </div>
            )}
            {item.email && (
              <div className="text-slate-500 flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400" />
                <span className="truncate max-w-[160px]">{item.email}</span>
              </div>
            )}
            {!item.phone && !item.email && <span className="text-slate-400">-</span>}
          </div>
        );
      },
    },
    {
      key: "invoicePrefix",
      label: "Doc Prefixes",
      className: "min-w-[140px]",
      render: (_, row) => {
        const item = row as unknown as OrgSettingsData;
        return (
          <div className="flex items-center gap-1 text-[11px] font-mono">
            <Badge variant="outline" className="px-1.5 py-0 text-slate-700">
              Inv: {item.invoicePrefix || "INV"}
            </Badge>
            <Badge variant="outline" className="px-1.5 py-0 text-slate-700">
              Rct: {item.receiptPrefix || "RCT"}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "isDefault",
      label: "Status",
      className: "w-28",
      render: (v, row) => {
        const item = row as unknown as OrgSettingsData;
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant={item.isActive ? (v ? "success" : "default") : "muted"}>
              {item.isActive ? (v ? "Primary" : "Active") : "Inactive"}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "_id",
      label: "Actions",
      className: "w-28 text-right",
      render: (_, row) => {
        const item = row as unknown as OrgSettingsData;
        return (
          <div className="flex items-center justify-end gap-1">
            {!item.isDefault && item.isActive && (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Set as Primary Organisation"
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => handleSetDefault(item)}
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit Profile"
              className="text-primary hover:bg-primary/10"
              onClick={() => openEdit(item)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {!item.isDefault && (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Deactivate Profile"
                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                onClick={() => handleDelete(item)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation Management"
        description="Configure multiple companies, branch entities, and document prefixes"
      >
        <Button onClick={openAdd} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Company / Branch
        </Button>
      </PageHeader>

      {/* Top Banner: Primary Active Organization Details */}
      {defaultOrg && (
        <div className="rounded-xl border border-primary/20 bg-linear-to-r from-primary/5 via-blue-50/40 to-slate-50 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {defaultOrg.companyName}
                  </h3>
                  <Badge variant="success" className="text-[11px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Primary Entity
                  </Badge>
                  {defaultOrg.orgCode && (
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {defaultOrg.orgCode}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5">
                  <span className="flex items-center gap-1 font-medium text-emerald-700">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                    Main Location
                  </span>
                  {defaultOrg.gstin && (
                    <span className="font-mono">GSTIN: {defaultOrg.gstin}</span>
                  )}
                  {defaultOrg.phone && <span>Phone: {defaultOrg.phone}</span>}
                  {defaultOrg.email && <span>Email: {defaultOrg.email}</span>}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="bg-white shrink-0 self-start md:self-auto text-xs"
              onClick={() => openEdit(defaultOrg)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit Primary Profile
            </Button>
          </div>
        </div>
      )}

      {/* Directory Table */}
      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={filteredData.length}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search company, branch code, or location..."
        emptyMessage="No organisation profiles found. Click 'Add Company / Branch' to create one."
      />

      {/* Add / Edit Organisation Profile Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {editing
                    ? `Edit Organisation: ${editing.companyName}`
                    : "Add Company / Branch Profile"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Map company to a Location, set tax credentials, banking, and billing prefixes.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 bg-white">
            {/* Section 1: Organisation & Location Mapping */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Company Profile & Location Mapping</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Company / Organisation Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    className="mt-1.5 bg-white text-sm"
                    placeholder="e.g. Evermore Estates Pvt. Ltd. / Flipkart"
                    value={form.companyName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, companyName: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Organisation / Branch Code
                  </Label>
                  <Input
                    className="mt-1.5 bg-white font-mono uppercase text-sm"
                    placeholder="e.g. EVM-NOIDA / FLP-MUM"
                    value={form.orgCode}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        orgCode: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

              </div>
            </div>

            {/* Section 2: Contact, Address & Tax */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span>Contact, Address & Tax Information</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">Phone</Label>
                  <Input
                    className="mt-1.5 bg-white text-xs"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Email</Label>
                  <Input
                    type="email"
                    className="mt-1.5 bg-white text-xs"
                    placeholder="contact@company.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Website</Label>
                  <Input
                    className="mt-1.5 bg-white text-xs"
                    placeholder="www.company.com"
                    value={form.website}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, website: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">GSTIN</Label>
                  <Input
                    className="mt-1.5 bg-white font-mono uppercase text-xs"
                    placeholder="07AAAAA0000A1Z5"
                    value={form.gstin}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        gstin: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">PAN</Label>
                  <Input
                    className="mt-1.5 bg-white font-mono uppercase text-xs"
                    placeholder="ABCDE1234F"
                    value={form.pan}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pan: e.target.value.toUpperCase() }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">Pincode</Label>
                  <Input
                    className="mt-1.5 bg-white text-xs"
                    placeholder="e.g. 201301"
                    value={form.pincode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pincode: e.target.value }))
                    }
                  />
                </div>

                <div className="sm:col-span-3">
                  <Label className="text-xs font-semibold text-slate-700">
                    Full Postal Address
                  </Label>
                  <Textarea
                    className="mt-1.5 bg-white resize-none text-xs"
                    rows={2}
                    placeholder="Building, Plot No, Road, Area..."
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">City</Label>
                  <Input
                    className="mt-1.5 bg-white text-xs"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, city: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">State</Label>
                  <Input
                    className="mt-1.5 bg-white text-xs"
                    placeholder="State"
                    value={form.state}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, state: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Prefixes, Banking & Settings */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span>Document Prefixes & Banking</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Invoice Prefix
                  </Label>
                  <Input
                    className="mt-1.5 bg-white font-mono uppercase text-xs"
                    placeholder="INV"
                    value={form.invoicePrefix}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        invoicePrefix: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Receipt Prefix
                  </Label>
                  <Input
                    className="mt-1.5 bg-white font-mono uppercase text-xs"
                    placeholder="RCT"
                    value={form.receiptPrefix}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        receiptPrefix: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Voucher Prefix
                  </Label>
                  <Input
                    className="mt-1.5 bg-white font-mono uppercase text-xs"
                    placeholder="VCH"
                    value={form.voucherPrefix}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        voucherPrefix: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-3">
                  <Label className="text-xs font-semibold text-slate-700">
                    Bank Account Details (Printed on Invoices)
                  </Label>
                  <Textarea
                    className="mt-1.5 bg-white resize-none text-xs"
                    rows={2}
                    placeholder="Bank Name: HDFC Bank&#10;A/C No: 50200012345678&#10;IFSC: HDFC0000123&#10;Branch: Sector 62, Noida"
                    value={form.bankDetails}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, bankDetails: e.target.value }))
                    }
                  />
                </div>

                <div className="sm:col-span-3">
                  <Label className="text-xs font-semibold text-slate-700">
                    Invoice Footer / Terms Note
                  </Label>
                  <Input
                    className="mt-1.5 bg-white text-xs"
                    placeholder="e.g. Thank you for choosing our services. Please pay within 15 days."
                    value={form.invoiceFooter}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, invoiceFooter: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saving}
              onClick={handleSave}
            >
              {editing ? "Update Profile" : "Save Organisation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
