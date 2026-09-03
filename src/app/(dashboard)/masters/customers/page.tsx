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
  Building2,
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
  isTaxable?: boolean;
  gstRate?: number;
}

interface LocationRef {
  _id: string;
  name: string;
  locationId?: string;
}

interface OrgRef {
  _id: string;
  companyName: string;
  orgCode?: string;
  locationId?: string | LocationRef;
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
  orgId?: string | OrgRef;
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

interface OrgOption {
  _id: string;
  companyName: string;
  orgCode?: string;
  locationId?: string | LocationRef;
  isDefault?: boolean;
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
  orgId: "",
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

const GST_SLABS = [0, 5, 12, 18, 28];

function getServiceUnitsAndAmount(s: CustomerService): {
  units: number;
  amount: number;
  gstAmount: number;
  totalAmount: number;
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
  const amount = parseFloat(((Number(s.rate) || 0) * units).toFixed(2));
  const isTaxable = s.isTaxable !== false;
  const gstRate = Number(s.gstRate) || 0;
  const gstAmount = isTaxable ? parseFloat(((amount * gstRate) / 100).toFixed(2)) : 0;
  const totalAmount = parseFloat((amount + gstAmount).toFixed(2));
  return { units, amount, gstAmount, totalAmount, readingDiff };
}

function calculateTotalServiceAmount(services: CustomerService[] = []): {
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  gstBreakdown: Record<number, number>;
} {
  const gstBreakdown: Record<number, number> = {};
  let subtotal = 0;
  let totalGst = 0;

  for (const s of services) {
    const { amount, gstAmount } = getServiceUnitsAndAmount(s);
    subtotal = parseFloat((subtotal + amount).toFixed(2));
    totalGst = parseFloat((totalGst + gstAmount).toFixed(2));
    if (gstAmount > 0) {
      const rate = Number(s.gstRate) || 0;
      gstBreakdown[rate] = parseFloat(((gstBreakdown[rate] || 0) + gstAmount).toFixed(2));
    }
  }

  const grandTotal = parseFloat((subtotal + totalGst).toFixed(2));
  return { subtotal, totalGst, grandTotal, gstBreakdown };
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
  const [viewBillsLoading, setViewBillsLoading] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/customers?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`,
        { signal }
      );
      if (!r.ok) { setData([]); setTotal(0); return; }
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setData([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  useEffect(() => {
    const ac = new AbortController();
    let mounted = true;
    async function loadDropdowns() {
      try {
        const [locRes, orgRes] = await Promise.all([
          fetch("/api/locations?limit=100", { signal: ac.signal }),
          fetch("/api/settings/organisation", { signal: ac.signal }),
        ]);
        if (!mounted) return;
        if (locRes.ok) {
          const locJson = await locRes.json();
          if (locJson.data) setLocations(locJson.data);
        }
        if (orgRes.ok) {
          const orgJson = await orgRes.json();
          if (orgJson.data) setOrgs(orgJson.data);
        }
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    loadDropdowns();
    return () => { mounted = false; ac.abort(); };
  }, []);

  function openAdd() {
    setEditing(null);
    const defaultOrg = orgs.find((o) => o.isDefault) || orgs[0];
    const defaultLocId =
      typeof defaultOrg?.locationId === "object" && defaultOrg?.locationId !== null
        ? (defaultOrg.locationId as LocationRef)._id
        : (defaultOrg?.locationId as string) || "";

    setForm({
      ...emptyForm,
      orgId: defaultOrg?._id || "",
      billingLocationId: defaultLocId || "",
    });
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    const orgId =
      typeof c.orgId === "object" && c.orgId !== null
        ? (c.orgId as OrgRef)._id
        : (c.orgId as string) || "";

    // Auto-link the billing location from the client's organisation/branch.
    const linkedOrg = orgs.find((o) => o._id === orgId);
    const locId =
      linkedOrg
        ? typeof linkedOrg.locationId === "object" && linkedOrg.locationId !== null
          ? (linkedOrg.locationId as LocationRef)._id
          : (linkedOrg.locationId as string) || ""
        : "";

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
          isTaxable: s.isTaxable !== false,
          gstRate: s.isTaxable === false ? 0 : Number(s.gstRate) || 18,
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
      orgId: orgId,
      billingType: c.billingType || "monthly",
      billingLocationId: locId,
      billingStartDate: startDate,
      services: formattedServices,
    });
    setOpen(true);
  }

  function handleOrgChange(selectedOrgId: string) {
    const selectedOrg = orgs.find((o) => o._id === selectedOrgId);
    const mappedLocId =
      typeof selectedOrg?.locationId === "object" && selectedOrg?.locationId !== null
        ? (selectedOrg.locationId as LocationRef)._id
        : (selectedOrg?.locationId as string) || "";

    setForm((f) => ({
      ...f,
      orgId: selectedOrgId,
      billingLocationId: mappedLocId || f.billingLocationId,
    }));
  }

  async function handleView(c: Customer) {
    setViewCustomer(c);
    setViewCustomerBills([]);
    setViewBillsLoading(true);
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
    } finally {
      setViewBillsLoading(false);
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

    const orgName =
      typeof c.orgId === "object" && c.orgId !== null
        ? (c.orgId as OrgRef).companyName
        : orgs.find((o) => o._id === c.orgId)?.companyName || "";

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
      const services = form.services.map((s) => {
        const srv: CustomerService = {
          type: s.type,
          rate: Number(s.rate) || 0,
          units: Number(s.units) || 1,
          description: s.description || "",
          isTaxable: s.isTaxable !== false,
          gstRate: (s.isTaxable === false) ? 0 : (Number(s.gstRate) || 18),
          calculationMode: s.calculationMode,
          initialReading: Number(s.initialReading) || 0,
          currentReading: Number(s.currentReading) || 0,
        };
        return srv;
      });
      const payload = { ...form, services };

      const url = editing ? `/api/customers/${editing._id}` : "/api/customers";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to save client");
        return;
      }
      toast.success(
        editing ? "Client updated successfully" : "Client added successfully. First bill generated — check New Bills tab."
      );

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
          isTaxable: true,
          gstRate: 18,
        },
      ],
    }));
  };

  const handleServiceChange = (
    index: number,
    field: keyof CustomerService,
    value: string | number | boolean
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

      if (field === "isTaxable") {
        const taxable = Boolean(value);
        if (!taxable) {
          currentService.gstRate = 0;
        } else if ((Number(currentService.gstRate) || 0) === 0) {
          currentService.gstRate = 18;
        }
      }

      if (field === "gstRate") {
        const rate = Number(value) || 0;
        currentService.gstRate = rate;
        if (rate === 0) {
          currentService.isTaxable = false;
        } else {
          currentService.isTaxable = true;
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
      label: "Client & Organisation",
      render: (v, row) => {
        const item = row as unknown as Customer;
        const org =
          typeof item.orgId === "object" && item.orgId !== null
            ? (item.orgId as OrgRef)
            : orgs.find((o) => o._id === item.orgId);

        return (
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <span>{String(v || "-")}</span>
              {org && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-slate-600 bg-slate-50 border-slate-200"
                >
                  <Building2 className="h-2.5 w-2.5 mr-1 text-primary" />
                  {org.companyName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{String(row.mobile || "")}</span>
              {Boolean(row.email) && <span>• {String(row.email)}</span>}
            </div>
          </div>
        );
      },
    },
    {
      key: "billingType",
      label: "Billing Cycle",
      render: (v, row) => {
        const item = row as unknown as Customer;
        const totals = calculateTotalServiceAmount(item.services || []);
        return (
          <div>
            <div className="capitalize font-medium text-slate-800 flex items-center gap-1.5">
              <span>{String(v || "Monthly")}</span>
              <span className="text-slate-400">•</span>
              <span className="font-semibold text-primary">
                {formatCurrency(totals.grandTotal)}
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
        description="Manage client profiles, organization mapping, billing start dates, and recurring services"
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
                  Fill in client profile information, serving organisation, billing frequency, and services.
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

            {/* Section 3: Billing, Organisation & Preferences */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-sm border-b border-slate-200/60 pb-2">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span>Serving Organisation & Billing Schedule</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Organization Selection Dropdown */}
                <div className="md:col-span-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100 space-y-1.5">
                  <Label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-blue-600" />
                    Serving Company / Branch Organisation
                  </Label>
                  <select
                    value={form.orgId}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-md px-3 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">-- Select Organisation / Branch --</option>
                    {orgs.map((org) => (
                      <option key={org._id} value={org._id}>
                        {org.companyName} {org.orgCode ? `(${org.orgCode})` : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Links this client to the selected company branch for invoicing, tax credentials, and billing tracking.
                  </p>
                </div>

                <div className="md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Billing Frequency
                      </Label>
                      <div className="flex gap-1.5 p-1 mt-1.5 bg-slate-100/80 rounded-lg border border-slate-200">
                        {["monthly", "quarterly", "yearly"].map((freq) => {
                          const active = form.billingType === freq;
                          return (
                            <button
                              type="button"
                              key={freq}
                              onClick={() =>
                                setForm((f) => ({ ...f, billingType: freq }))
                              }
                              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                                active
                                  ? "bg-blue-600 text-white shadow-sm"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-white"
                              }`}
                            >
                              {freq}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">
                        Billing Start Date
                      </Label>
                      <Input
                        type="date"
                        className="mt-1.5 bg-white text-sm h-10"
                        value={form.billingStartDate}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, billingStartDate: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {form.billingStartDate && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs w-fit">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-slate-500">Next Bill Generation:</span>
                      <span className="font-semibold text-blue-900">
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
                    </div>
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

                        {/* GST Section for non-electricity services */}
                        {!isElectricity && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                            <div className="sm:col-span-1 flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1 rounded bg-sky-100">
                                  <Receipt className="h-3 w-3 text-sky-600" />
                                </div>
                                <Label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                  Apply GST
                                </Label>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleServiceChange(
                                    index,
                                    "isTaxable",
                                    !(service.isTaxable !== false)
                                  )
                                }
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  service.isTaxable !== false
                                    ? "bg-emerald-600"
                                    : "bg-slate-300"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                    service.isTaxable !== false
                                      ? "translate-x-5"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                            <div className="sm:col-span-1">
                              <Label className="text-xs text-slate-700 font-semibold">
                                GST Slab (%)
                              </Label>
                              <select
                                value={String(Number(service.gstRate) || 0)}
                                onChange={(e) =>
                                  handleServiceChange(
                                    index,
                                    "gstRate",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                disabled={service.isTaxable === false}
                                className={`mt-1 w-full h-9 border rounded-md px-2.5 text-xs focus:ring-2 font-semibold ${
                                  service.isTaxable === false
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-white border-slate-200 focus:ring-primary/20 text-slate-800"
                                }`}
                              >
                                {GST_SLABS.map((slab) => (
                                  <option key={slab} value={slab}>
                                    {slab === 0 ? "0% (Exempt)" : `${slab}%`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-1">
                              <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                <Calculator className="h-3 w-3 text-slate-400" />
                                Line Total
                              </Label>
                              <div className="mt-1 h-9 px-2.5 flex items-center rounded-md bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                                <span className="text-xs font-bold text-primary font-mono tabular-nums">
                                  {formatCurrency(
                                    getServiceUnitsAndAmount(service).totalAmount
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

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
                                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-3">
                                    <span>
                                      Base:{" "}
                                      <span className="font-mono text-amber-900">
                                        {formatCurrency(getServiceUnitsAndAmount(service).amount)}
                                      </span>
                                    </span>
                                    <span>
                                      GST {Number(service.gstRate) || 0}%:{" "}
                                      <span className="font-mono text-emerald-700">
                                        +{formatCurrency(getServiceUnitsAndAmount(service).gstAmount)}
                                      </span>
                                    </span>
                                    <span>
                                      Total:{" "}
                                      <span className="text-primary font-mono text-sm ml-1">
                                        {formatCurrency(getServiceUnitsAndAmount(service).totalAmount)}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                {/* GST Section for Electricity - Reading Mode */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                                  <div className="sm:col-span-1 flex items-center justify-between p-2 rounded-lg bg-white border border-amber-200">
                                    <div className="flex items-center gap-1.5">
                                      <div className="p-1 rounded bg-sky-100">
                                        <Receipt className="h-3 w-3 text-sky-600" />
                                      </div>
                                      <Label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                        Apply GST
                                      </Label>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleServiceChange(
                                          index,
                                          "isTaxable",
                                          !(service.isTaxable !== false)
                                        )
                                      }
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        service.isTaxable !== false
                                          ? "bg-emerald-600"
                                          : "bg-slate-300"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                          service.isTaxable !== false
                                            ? "translate-x-5"
                                            : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                  <div className="sm:col-span-1">
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      GST Slab (%)
                                    </Label>
                                    <select
                                      value={String(Number(service.gstRate) || 0)}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "gstRate",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      disabled={service.isTaxable === false}
                                      className={`mt-1 w-full h-9 border rounded-md px-2.5 text-xs focus:ring-2 font-semibold ${
                                        service.isTaxable === false
                                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                          : "bg-white border-slate-200 focus:ring-amber-500/20 text-slate-800"
                                      }`}
                                    >
                                      {GST_SLABS.map((slab) => (
                                        <option key={slab} value={slab}>
                                          {slab === 0 ? "0% (Exempt)" : `${slab}%`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="sm:col-span-1">
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <Calculator className="h-3 w-3 text-slate-400" />
                                      Line Total (incl. GST)
                                    </Label>
                                    <div className="mt-1 h-9 px-2.5 flex items-center rounded-md bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                                      <span className="text-xs font-bold text-primary font-mono tabular-nums">
                                        {formatCurrency(
                                          getServiceUnitsAndAmount(service).totalAmount
                                        )}
                                      </span>
                                    </div>
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

                                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-amber-950 font-medium">
                                    Formula: {service.units || 0} kWh × ₹{service.rate || 0}
                                  </span>
                                  <div className="font-bold text-slate-900 flex flex-wrap items-center gap-3">
                                    <span>
                                      GST {Number(service.gstRate) || 0}%:{" "}
                                      <span className="font-mono text-emerald-700">
                                        +{formatCurrency(getServiceUnitsAndAmount(service).gstAmount)}
                                      </span>
                                    </span>
                                    <span>
                                      Total:{" "}
                                      <span className="text-primary font-mono text-sm ml-1">
                                        {formatCurrency(getServiceUnitsAndAmount(service).totalAmount)}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                {/* GST Section for Electricity - Direct Mode */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                                  <div className="sm:col-span-1 flex items-center justify-between p-2 rounded-lg bg-white border border-amber-200">
                                    <div className="flex items-center gap-1.5">
                                      <div className="p-1 rounded bg-sky-100">
                                        <Receipt className="h-3 w-3 text-sky-600" />
                                      </div>
                                      <Label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                        Apply GST
                                      </Label>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleServiceChange(
                                          index,
                                          "isTaxable",
                                          !(service.isTaxable !== false)
                                        )
                                      }
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        service.isTaxable !== false
                                          ? "bg-emerald-600"
                                          : "bg-slate-300"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                          service.isTaxable !== false
                                            ? "translate-x-5"
                                            : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </div>
                                  <div className="sm:col-span-1">
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      GST Slab (%)
                                    </Label>
                                    <select
                                      value={String(Number(service.gstRate) || 0)}
                                      onChange={(e) =>
                                        handleServiceChange(
                                          index,
                                          "gstRate",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      disabled={service.isTaxable === false}
                                      className={`mt-1 w-full h-9 border rounded-md px-2.5 text-xs focus:ring-2 font-semibold ${
                                        service.isTaxable === false
                                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                          : "bg-white border-slate-200 focus:ring-amber-500/20 text-slate-800"
                                      }`}
                                    >
                                      {GST_SLABS.map((slab) => (
                                        <option key={slab} value={slab}>
                                          {slab === 0 ? "0% (Exempt)" : `${slab}%`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="sm:col-span-1">
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <Calculator className="h-3 w-3 text-slate-400" />
                                      Line Total (incl. GST)
                                    </Label>
                                    <div className="mt-1 h-9 px-2.5 flex items-center rounded-md bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20">
                                      <span className="text-xs font-bold text-primary font-mono tabular-nums">
                                        {formatCurrency(
                                          getServiceUnitsAndAmount(service).totalAmount
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {(() => {
                    const totals = calculateTotalServiceAmount(form.services);
                    const gstEntries = Object.entries(totals.gstBreakdown).sort(
                      (a, b) => Number(a[0]) - Number(b[0])
                    );
                    return (
                      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden shadow-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                          <div className="p-4 space-y-2 border-b sm:border-b-0 sm:border-r border-slate-200">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Base Subtotal</span>
                              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                                {formatCurrency(totals.subtotal)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                Services ({form.services.length} line{form.services.length !== 1 ? "s" : ""})
                              </span>
                              <span className="font-mono text-slate-500">
                                {form.services.length} items
                              </span>
                            </div>
                          </div>
                          <div className="p-4 space-y-2">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="p-0.5 rounded bg-emerald-100">
                                <Receipt className="h-2.5 w-2.5 text-emerald-600" />
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                GST Breakdown
                              </span>
                            </div>
                            {gstEntries.length === 0 ? (
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 italic">No GST applicable</span>
                                <span className="font-mono text-slate-400">—</span>
                              </div>
                            ) : (
                              gstEntries.map(([rate, amt]) => (
                                <div
                                  key={rate}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    CGST+SGST @ {rate}%
                                  </span>
                                  <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                                    + {formatCurrency(amt)}
                                  </span>
                                </div>
                              ))
                            )}
                            {totals.totalGst > 0 && (
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100 mt-1">
                                <span className="font-semibold text-slate-700">Total GST</span>
                                <span className="font-mono font-bold text-emerald-700 tabular-nums">
                                  {formatCurrency(totals.totalGst)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="px-4 py-3 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-t border-primary/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-slate-800">
                              Grand Total (Periodic Billing)
                            </span>
                          </div>
                          <span className="text-lg font-extrabold text-primary font-mono tabular-nums">
                            {formatCurrency(totals.grandTotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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
                size="sm"
                className="px-6 shadow-xs"
                loading={saving}
                onClick={() => handleSave()}
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
            {/* Serving Organisation Banner */}
            {viewCustomer?.orgId && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      {typeof viewCustomer.orgId === "object"
                        ? viewCustomer.orgId.companyName
                        : "Organisation"}
                    </span>
                    {typeof viewCustomer.orgId === "object" &&
                      viewCustomer.orgId.orgCode && (
                        <span className="text-[10px] font-mono text-slate-500 ml-1.5">
                          ({viewCustomer.orgId.orgCode})
                        </span>
                      )}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-blue-700 bg-white">
                  Serving Entity
                </Badge>
              </div>
            )}

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
                      const {
                        units: calculatedUnits,
                        amount: calculatedAmount,
                        gstAmount: calcGst,
                        totalAmount: calcTotal,
                      } = getServiceUnitsAndAmount(s);
                      const isElectricity =
                        (s.type || "").toLowerCase() === "electricity";
                      const isReadingMode =
                        isElectricity && s.calculationMode !== "direct";
                      const gstRate = Number(s.gstRate) || 0;
                      const taxable = s.isTaxable !== false;

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
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
                              {taxable ? (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  GST {gstRate}%
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                  Exempt
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-slate-900 text-xs font-mono tabular-nums">
                              {formatCurrency(calcTotal)}
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

                          <div className="flex flex-wrap items-center justify-end gap-3 pt-1 border-t border-slate-200 mt-1">
                            <span className="text-[11px] text-slate-500">
                              Base: <span className="font-mono font-medium text-slate-700">{formatCurrency(calculatedAmount)}</span>
                            </span>
                            {taxable && (
                              <span className="text-[11px] text-slate-500">
                                GST: <span className="font-mono font-medium text-emerald-700">+{formatCurrency(calcGst)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* View mode summary footer */}
                    {(() => {
                      const totals = calculateTotalServiceAmount(viewCustomer?.services ?? []);
                      return (
                        <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-white">
                          <div className="flex items-center justify-between text-xs">
                            <div className="space-y-1">
                              <div className="text-slate-500">Subtotal: <span className="font-mono font-medium text-slate-700">{formatCurrency(totals.subtotal)}</span></div>
                              {totals.totalGst > 0 && (
                                <div className="text-slate-500">Total GST: <span className="font-mono font-medium text-emerald-700">{formatCurrency(totals.totalGst)}</span></div>
                              )}
                            </div>
                            <div className="text-sm font-extrabold text-primary font-mono tabular-nums">
                              {formatCurrency(totals.grandTotal)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

            {/* Invoices / Bills for this client */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-slate-500" />
                  Client Invoices & Bills {viewBillsLoading ? "" : `(${viewCustomerBills.length})`}
                </span>
                {viewBillsLoading && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse"></span>
                    Loading...
                  </span>
                )}
              </span>
              {viewBillsLoading ? (
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-1"
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="h-3 w-24 bg-gradient-to-r from-slate-200/80 via-slate-200/50 to-slate-200/80 rounded relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        </div>
                        <div className="h-2.5 w-36 bg-gradient-to-r from-slate-200/70 via-slate-200/40 to-slate-200/70 rounded relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite_0.1s] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-14 bg-gradient-to-r from-slate-200/80 via-slate-200/50 to-slate-200/80 rounded relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite_0.15s] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        </div>
                        <div className="h-5 w-12 bg-gradient-to-r from-slate-200/70 via-slate-200/40 to-slate-200/70 rounded-full relative overflow-hidden">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite_0.2s] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewCustomerBills.length === 0 ? (
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
