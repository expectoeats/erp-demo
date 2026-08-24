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
  FileText,
  Calendar,
  Receipt,
  CheckCircle2,
  Clock,
  Zap,
  Gauge,
  Calculator,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { generateClientReportPDF } from "@/lib/utils/client-report";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CustomerService {
  type: string;
  rate: number;
  units: number;
  calculationMode?: "reading" | "direct";
  initialReading?: number;
  currentReading?: number;
  description?: string;
}

interface LocationRef {
  _id: string;
  name: string;
  locationId?: string;
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
  billingType?: "monthly" | "quarterly" | "yearly";
  billingLocationId?: string | LocationRef;
  billingStartDate?: string;
  nextBillingDate?: string;
  services?: CustomerService[];
  createdAt?: string;
}

interface CustomerBill {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  billingMonth: string;
  billingYear: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: "unpaid" | "partially_paid" | "paid" | "overdue" | "cancelled";
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
  billingType: "monthly",
  billingLocationId: "",
  billingStartDate: new Date().toISOString().split("T")[0],
  services: [] as CustomerService[],
};

const serviceTypes = [
  { value: "security", label: "Security" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "maintenance", label: "Maintenance" },
  { value: "others", label: "Others" },
];

function getServiceUnitsAndAmount(s: CustomerService): {
  units: number;
  amount: number;
  readingDiff?: number;
} {
  const isElectricity = (s.type || "").toLowerCase() === "electricity";
  let units = Number(s.units) || 0;
  let readingDiff: number | undefined = undefined;

  if (isElectricity && s.calculationMode !== "direct") {
    const init = Number(s.initialReading) || 0;
    const curr = Number(s.currentReading) || 0;
    units = Math.max(0, curr - init);
    readingDiff = units;
  }
  const amount = (Number(s.rate) || 0) * units;
  return { units, amount, readingDiff };
}

function calculateTotalServiceAmount(services: CustomerService[] = []): number {
  return services.reduce((acc, s) => {
    const { amount } = getServiceUnitsAndAmount(s);
    return acc + amount;
  }, 0);
}

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
  const [viewCustomerBills, setViewCustomerBills] = useState<CustomerBill[]>([]);
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
    const locId =
      typeof c.billingLocationId === "object" && c.billingLocationId !== null
        ? (c.billingLocationId as LocationRef)._id
        : (c.billingLocationId as string) || "";

    const startDate = c.billingStartDate
      ? new Date(c.billingStartDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    const formattedServices: CustomerService[] = Array.isArray(c.services)
      ? c.services.map((s) => ({
          type: (s.type || "maintenance").toLowerCase(),
          rate: Number(s.rate) || 0,
          units: Number(s.units) || 1,
          calculationMode:
            s.calculationMode ||
            ((s.type || "").toLowerCase() === "electricity" ? "reading" : "direct"),
          initialReading: Number(s.initialReading) || 0,
          currentReading: Number(s.currentReading) || 0,
          description: s.description || "",
        }))
      : [];

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
      billingType: c.billingType || "monthly",
      billingLocationId: locId,
      billingStartDate: startDate,
      services: formattedServices,
    });
    setOpen(true);
  }

  async function handleView(c: Customer) {
    setViewCustomer(c);
    setViewCustomerBills([]);
    setViewOpen(true);

    try {
      const res = await fetch(`/api/customers/${c._id}`);
      const json = await res.json();
      if (json.data) {
        if (json.data.customer) setViewCustomer(json.data.customer);
        if (json.data.recentBills) setViewCustomerBills(json.data.recentBills);
      }
    } catch {
      // ignore silently
    }
  }

  function handleGenerateCustomerReport(c: Customer) {
    const locId =
      typeof c.billingLocationId === "object" && c.billingLocationId !== null
        ? (c.billingLocationId as LocationRef)._id
        : (c.billingLocationId as string) || "";
    const loc = locations.find((l) => l._id === locId);
    const locName = loc
      ? `${loc.name}${loc.locationId ? ` (${loc.locationId})` : ""}`
      : typeof c.billingLocationId === "object" && c.billingLocationId !== null
      ? (c.billingLocationId as LocationRef).name
      : "";

    generateClientReportPDF({
      customerId: c.customerId,
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      gstin: c.gstin,
      pan: c.pan,
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      billingType: c.billingType,
      billingLocationName: locName,
      billingStartDate: c.billingStartDate,
      nextBillingDate: c.nextBillingDate,
      services: c.services,
      isActive: c.isActive,
      createdAt: c.createdAt,
    });
  }

  async function handleSave(withReport = false) {
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
      toast.success(
        editing ? "Client updated successfully" : "Client added successfully"
      );

      if (withReport) {
        const savedCustomer = d.data || (editing ? { ...editing, ...form } : form);
        const loc = locations.find((l) => l._id === form.billingLocationId);
        const locName = loc
          ? `${loc.name}${loc.locationId ? ` (${loc.locationId})` : ""}`
          : "";
        generateClientReportPDF({
          customerId: savedCustomer.customerId,
          name: form.name,
          mobile: form.mobile,
          email: form.email,
          gstin: form.gstin,
          pan: form.pan,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          billingType: form.billingType,
          billingLocationName: locName,
          billingStartDate: form.billingStartDate,
          services: form.services,
          isActive:
            savedCustomer.isActive !== undefined ? savedCustomer.isActive : true,
          createdAt: savedCustomer.createdAt,
        });
      }

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
        {
          type: "maintenance",
          rate: 0,
          units: 1,
          calculationMode: "direct",
          initialReading: 0,
          currentReading: 0,
        },
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
      const currentService = { ...services[index], [field]: value };

      if (field === "type") {
        const typeStr = String(value).toLowerCase();
        currentService.type = typeStr;
        if (typeStr === "electricity") {
          currentService.calculationMode = currentService.calculationMode || "reading";
        }
      }

      services[index] = currentService;
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
      className: "w-28 font-mono font-semibold text-xs text-slate-800",
    },
    {
      key: "name",
      label: "Name & Contact",
      render: (v, row) => (
        <div>
          <div className="font-semibold text-slate-900">{String(v || "-")}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span>{String(row.mobile || "")}</span>
            {Boolean(row.email) && <span>• {String(row.email)}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "billingType",
      label: "Billing Cycle",
      render: (v, row) => {
        const item = row as unknown as Customer;
        const totalServices = calculateTotalServiceAmount(item.services || []);
        return (
          <div>
            <div className="capitalize font-medium text-slate-800 flex items-center gap-1.5">
              <span>{String(v || "Monthly")}</span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-primary">
                {formatCurrency(totalServices)}
              </span>
            </div>
            {item.billingStartDate && (
              <div className="text-[11px] text-slate-500 mt-0.5">
                Starts: {formatDate(item.billingStartDate)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "nextBillingDate",
      label: "Next Bill Date",
      render: (v) =>
        v ? (
          <div className="flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
            <Clock className="h-3 w-3" />
            {formatDate(String(v))}
          </div>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
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
      className: "w-28 text-right",
      render: (_, row) => {
        const item = row as unknown as Customer;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Generate Report (PDF)"
              className="text-slate-600 hover:text-primary hover:bg-slate-100"
              onClick={() => handleGenerateCustomerReport(item)}
            >
              <FileText className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="View Details"
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              onClick={() => handleView(item)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit Client"
              className="text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => openEdit(item)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage client profiles, billing start dates, frequencies, and assigned recurring services"
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
        searchPlaceholder="Search by client name, mobile, email, client ID..."
        emptyMessage="No clients found. Click 'Add Client' to onboard your first client."
      />

      {/* Add / Edit Client Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden shadow-2xl">
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
                  Fill in client profile information, billing frequency, start date, and services.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 bg-white">
            {/* Section 1: Basic Information */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <User className="h-4 w-4 text-primary" />
                <span>Basic Information</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Client Name <span className="text-rose-500">*</span>
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

            {/* Section 3: Billing & Preferences */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span>Billing Preferences & Schedule</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Billing Frequency
                  </Label>
                  <div className="flex flex-wrap gap-3 items-center mt-1 bg-white p-2 rounded-lg border border-slate-200">
                    {["monthly", "quarterly", "yearly"].map((freq) => (
                      <label
                        key={freq}
                        className="flex items-center gap-1.5 text-xs text-slate-700 capitalize cursor-pointer font-medium"
                      >
                        <input
                          type="radio"
                          name="billingType"
                          value={freq}
                          checked={form.billingType === freq}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, billingType: e.target.value }))
                          }
                          className="accent-primary h-3.5 w-3.5"
                        />
                        <span>{freq}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-2 block">
                    Billing Start Date
                  </Label>
                  <Input
                    type="date"
                    className="mt-1 bg-white text-sm"
                    value={form.billingStartDate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, billingStartDate: e.target.value }))
                    }
                  />
                  {form.billingStartDate && (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Next bill:{" "}
                      <span className="text-primary font-semibold">
                        {(() => {
                          const d = new Date(form.billingStartDate);
                          if (form.billingType === "quarterly")
                            d.setMonth(d.getMonth() + 3);
                          else if (form.billingType === "yearly")
                            d.setFullYear(d.getFullYear() + 1);
                          else d.setMonth(d.getMonth() + 1);
                          return d.toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          });
                        })()}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Assigned Services */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                  <Layers className="h-4 w-4 text-amber-600" />
                  <span>Assigned Services & Rates</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addServiceRow}
                  className="h-7 text-xs bg-white shadow-2xs"
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
                <div className="space-y-4">
                  {form.services.map((service, index) => {
                    const isElectricity =
                      (service.type || "").toLowerCase() === "electricity";
                    const isReadingMode =
                      isElectricity && service.calculationMode !== "direct";
                    const { units: calculatedUnits, amount: calculatedAmount } =
                      getServiceUnitsAndAmount(service);

                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-xl border transition-all ${
                          isElectricity
                            ? "border-amber-300 bg-amber-50/30 shadow-xs"
                            : "border-slate-200 bg-white shadow-xs"
                        } space-y-3`}
                      >
                        {/* Service Row Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isElectricity ? (
                              <div className="p-1 rounded bg-amber-500 text-white">
                                <Zap className="h-3.5 w-3.5" />
                              </div>
                            ) : (
                              <div className="p-1 rounded bg-slate-100 text-slate-500">
                                <Layers className="h-3.5 w-3.5" />
                              </div>
                            )}
                            <span className="text-xs font-bold text-slate-800">
                              Service #{index + 1}:{" "}
                              <span className="capitalize font-semibold text-primary">
                                {service.type || "Service"}
                              </span>
                            </span>
                          </div>
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

                        {/* Top: Service Type Selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs text-slate-700 font-semibold">
                              Service Type
                            </Label>
                            <select
                              value={(service.type || "maintenance").toLowerCase()}
                              onChange={(e) =>
                                handleServiceChange(index, "type", e.target.value)
                              }
                              className="mt-1 w-full h-9 border border-slate-200 rounded-md px-2.5 text-xs bg-white focus:ring-2 focus:ring-primary/20 font-medium capitalize"
                            >
                              {serviceTypes.map((st) => (
                                <option key={st.value} value={st.value}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Standard Rate & Units for non-electricity services */}
                          {!isElectricity && (
                            <>
                              <div>
                                <Label className="text-xs text-slate-700 font-semibold">
                                  Rate (₹)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="mt-1 h-9 text-xs bg-white"
                                  value={service.rate || ""}
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
                                <Label className="text-xs text-slate-700 font-semibold">
                                  Units / Quantity
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="mt-1 h-9 text-xs bg-white"
                                  value={service.units || ""}
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
                            </>
                          )}
                        </div>

                        {/* Dedicated Electricity Dual Calculation Mode UI */}
                        {isElectricity && (
                          <div className="space-y-3 pt-2 border-t border-amber-200/80">
                            <div>
                              <Label className="text-xs font-bold text-amber-950 block mb-1.5 flex items-center gap-1.5">
                                <Calculator className="h-3.5 w-3.5 text-amber-600" />
                                Electricity Calculation Mode (Select Option):
                              </Label>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-2 rounded-xl border border-amber-200 shadow-2xs">
                                <label
                                  className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs cursor-pointer border transition-all ${
                                    isReadingMode
                                      ? "bg-amber-50/80 border-amber-400 text-amber-950 ring-1 ring-amber-300"
                                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`elec-mode-${index}`}
                                    value="reading"
                                    checked={isReadingMode}
                                    onChange={() =>
                                      handleServiceChange(
                                        index,
                                        "calculationMode",
                                        "reading"
                                      )
                                    }
                                    className="accent-amber-600 h-4 w-4 mt-0.5 shrink-0"
                                  />
                                  <div>
                                    <div className="font-bold flex items-center gap-1">
                                      <Gauge className="h-3.5 w-3.5 text-amber-600" />
                                      <span>Mode 1: Meter Reading Difference</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                      Subtracts initial start reading so client only pays for actual usage during their period.
                                    </p>
                                  </div>
                                </label>

                                <label
                                  className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs cursor-pointer border transition-all ${
                                    !isReadingMode
                                      ? "bg-amber-50/80 border-amber-400 text-amber-950 ring-1 ring-amber-300"
                                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`elec-mode-${index}`}
                                    value="direct"
                                    checked={!isReadingMode}
                                    onChange={() =>
                                      handleServiceChange(
                                        index,
                                        "calculationMode",
                                        "direct"
                                      )
                                    }
                                    className="accent-amber-600 h-4 w-4 mt-0.5 shrink-0"
                                  />
                                  <div>
                                    <div className="font-bold flex items-center gap-1">
                                      <Zap className="h-3.5 w-3.5 text-amber-600" />
                                      <span>Mode 2: Direct Consumed Units</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                      Direct input of exact consumed units and rate per unit.
                                    </p>
                                  </div>
                                </label>
                              </div>
                            </div>

                            {/* Mode 1 Inputs: Meter Reading Difference */}
                            {isReadingMode ? (
                              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Initial / Start Reading (kWh)
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="mt-1 h-9 text-xs"
                                      value={service.initialReading || ""}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "initialReading",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 1200"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                      Pre-existing meter reading
                                    </span>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Current / Final Reading (kWh)
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="mt-1 h-9 text-xs"
                                      value={service.currentReading || ""}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "currentReading",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 1350"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                      Total reading after period
                                    </span>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Rate per Unit (₹/kWh)
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="mt-1 h-9 text-xs"
                                      value={service.rate || ""}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "rate",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 8.00"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                      Unit charge in Rupees
                                    </span>
                                  </div>
                                </div>

                                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-amber-950">
                                    <span className="font-semibold">Client&apos;s Electricity Usage:</span>{" "}
                                    <span className="font-mono font-bold">
                                      {service.currentReading || 0} - {service.initialReading || 0} ={" "}
                                      <span className="text-primary text-sm font-extrabold">{calculatedUnits} kWh</span>
                                    </span>
                                  </div>
                                  <div className="font-bold text-slate-900">
                                    Total Amount:{" "}
                                    <span className="text-primary font-mono text-sm ml-1">
                                      {formatCurrency(calculatedAmount)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Mode 2 Inputs: Direct Consumed Units */
                              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Direct Consumed Units (kWh)
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="mt-1 h-9 text-xs"
                                      value={service.units || ""}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "units",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 20"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Rate per Unit (₹/kWh)
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="any"
                                      className="mt-1 h-9 text-xs"
                                      value={service.rate || ""}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "rate",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 5.00"
                                    />
                                  </div>
                                </div>

                                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs flex items-center justify-between">
                                  <span className="text-amber-950 font-medium">
                                    Formula: {service.units || 0} kWh × ₹{service.rate || 0}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    Total Amount:{" "}
                                    <span className="text-primary font-mono text-sm ml-1">
                                      {formatCurrency(calculatedAmount)}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex justify-end p-3 bg-slate-100 rounded-xl text-xs font-medium text-slate-700">
                    Total Periodic Amount:{" "}
                    <span className="font-bold text-primary ml-1 text-base">
                      {formatCurrency(calculateTotalServiceAmount(form.services))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer with Visible Buttons */}
          <DialogFooter className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="px-4"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-medium shadow-2xs"
                loading={saving}
                onClick={() => handleSave(true)}
              >
                <FileText className="h-4 w-4 text-blue-600" />
                Save & Generate Report (PDF)
              </Button>
              <Button
                type="button"
                size="sm"
                className="px-5 shadow-xs"
                loading={saving}
                onClick={() => handleSave(false)}
              >
                {editing ? "Update Client" : "Save Client"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Client Details Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl">
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

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 text-sm bg-white">
            {/* Contact & Tax Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400 block uppercase font-medium">
                  Mobile
                </span>
                <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5 text-xs">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {viewCustomer?.mobile || "-"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block uppercase font-medium">
                  Email
                </span>
                <span className="font-medium text-slate-800 flex items-center gap-1 mt-0.5 text-xs truncate">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{viewCustomer?.email || "-"}</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block uppercase font-medium">
                  GSTIN
                </span>
                <span className="font-mono font-medium text-slate-800 mt-0.5 block text-xs">
                  {viewCustomer?.gstin || "-"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block uppercase font-medium">
                  PAN
                </span>
                <span className="font-mono font-medium text-slate-800 mt-0.5 block text-xs">
                  {viewCustomer?.pan || "-"}
                </span>
              </div>
            </div>

            {/* Billing Schedule Summary */}
            <div className="p-3.5 rounded-lg border border-indigo-100 bg-indigo-50/50 space-y-2">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-indigo-600" />
                Billing Schedule & Preferences
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <span className="text-slate-500 block">Frequency:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {viewCustomer?.billingType || "Monthly"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Start Date:</span>
                  <span className="font-semibold text-slate-800">
                    {viewCustomer?.billingStartDate
                      ? formatDate(viewCustomer.billingStartDate)
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Next Billing Date:</span>
                  <span className="font-semibold text-primary">
                    {viewCustomer?.nextBillingDate
                      ? formatDate(viewCustomer.nextBillingDate)
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Address */}
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

            {/* Assigned Services */}
            {Array.isArray(viewCustomer?.services) &&
              viewCustomer.services.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-slate-700 block mb-2">
                    Assigned Services ({viewCustomer.services.length})
                  </span>
                  <div className="space-y-2.5">
                    {viewCustomer.services.map((s, idx) => {
                      const { units: calculatedUnits, amount: calculatedAmount } =
                        getServiceUnitsAndAmount(s);
                      const isElectricity =
                        (s.type || "").toLowerCase() === "electricity";
                      const isReadingMode =
                        isElectricity && s.calculationMode !== "direct";

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={isElectricity ? "warning" : "outline"}
                                className="capitalize text-[11px]"
                              >
                                {s.type}
                              </Badge>
                              {isReadingMode && (
                                <span className="text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium border border-amber-200">
                                  Meter Reading Diff
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-900 text-xs font-mono">
                              {formatCurrency(calculatedAmount)}
                            </span>
                          </div>

                          {isReadingMode ? (
                            <div className="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-1 pt-1">
                              <span>
                                Reading: {s.currentReading || 0} - {s.initialReading || 0} ={" "}
                                <strong className="text-slate-800">{calculatedUnits} kWh</strong>
                              </span>
                              <span>
                                Rate: ₹{s.rate}/kWh
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-600 flex items-center justify-between pt-1">
                              <span>
                                Rate: ₹{s.rate} × {calculatedUnits} {isElectricity ? "kWh" : "units"}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Invoices / Bills for this client */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-slate-500" />
                  Client Invoices & Bills ({viewCustomerBills.length})
                </span>
              </span>
              {viewCustomerBills.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                  No invoices generated yet for this client.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {viewCustomerBills.map((bill) => (
                    <div
                      key={bill._id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-slate-800">
                          {bill.invoiceNumber}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {bill.billingMonth} {bill.billingYear} • Due:{" "}
                          {formatDate(bill.dueDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(bill.grandTotal)}
                        </span>
                        <Badge
                          variant={
                            bill.status === "paid"
                              ? "success"
                              : bill.status === "unpaid"
                              ? "warning"
                              : "default"
                          }
                          className="capitalize text-[11px]"
                        >
                          {bill.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-slate-200 bg-slate-50/90 shrink-0 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewOpen(false)}
            >
              Close
            </Button>
            <div className="flex items-center gap-2">
              {viewCustomer && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-medium shadow-2xs"
                  onClick={() => handleGenerateCustomerReport(viewCustomer)}
                >
                  <FileText className="h-3.5 w-3.5" /> Generate Report (PDF)
                </Button>
              )}
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
