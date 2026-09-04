"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Eye, AlertCircle, FileText, CheckCircle2, XCircle, Clock,
  Pencil, Plus, Trash2, Zap, Calculator, Layers,
  Lock, Receipt, Loader2, FilePlus2, CalendarClock,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillItem {
  serviceName: string;
  serviceCode?: string;
  calculationType?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  isTaxable: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  notes?: string;
}

interface Bill {
  _id: string;
  invoiceNumber: string;
  customerId: { _id?: string; name: string; customerId: string; mobile?: string };
  unitId?: { _id?: string; unitCode: string };
  locationId?: { _id?: string; name: string };
  invoiceDate: string;
  dueDate: string;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  billingMonth: string;
  billingYear: number;
  items?: BillItem[];
}

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

type BillingType = "monthly" | "quarterly" | "yearly";

interface BillStats {
  totalBills: number;
  unpaidCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overdueCount: number;
  cancelledCount: number;
  totalAmount: number;
  totalPaid: number;
  totalOutstanding: number;
}

interface FinancialYear {
  _id: string;
  name: string;
  isActive: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

const serviceTypes = [
  { value: "security",    label: "Security" },
  { value: "electricity", label: "Electricity" },
  { value: "water",       label: "Water" },
  { value: "maintenance", label: "Maintenance" },
  { value: "others",      label: "Others" },
];

const GST_SLABS = [0, 5, 12, 18, 28];

const statusVariants: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "muted" | "info"
> = {
  unpaid: "warning", partially_paid: "default", paid: "success",
  overdue: "destructive", cancelled: "muted",
};

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly",
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Next billing period based on the client's locked billing frequency.
 * monthly=+1m  quarterly=+3m  yearly=+12m
 */
function getNextPeriod(month: string, year: number, billingType: BillingType = "monthly") {
  const idx = MONTHS.indexOf(month);
  if (idx === -1) return { month: MONTHS[new Date().getMonth()], year };
  const step = billingType === "quarterly" ? 3 : billingType === "yearly" ? 12 : 1;
  const total = year * 12 + idx + step;
  return { month: MONTHS[total % 12], year: Math.floor(total / 12) };
}

function getServiceUnitsAndAmount(s: CustomerService) {
  const isElec = (s.type || "").toLowerCase() === "electricity";
  let units = Number(s.units) || 0;
  if (isElec && s.calculationMode !== "direct") {
    units = Math.max(0, (Number(s.currentReading) || 0) - (Number(s.initialReading) || 0));
  }
  const amount    = parseFloat(((Number(s.rate) || 0) * units).toFixed(2));
  const gstRate   = Number(s.gstRate) || 0;
  const gstAmount = s.isTaxable !== false && gstRate > 0
    ? parseFloat(((amount * gstRate) / 100).toFixed(2)) : 0;
  return { units, amount, gstAmount, totalAmount: parseFloat((amount + gstAmount).toFixed(2)) };
}

function calcTotals(services: CustomerService[]) {
  const gstBreakdown: Record<number, number> = {};
  let subtotal = 0, totalGst = 0;
  for (const s of services) {
    const { amount, gstAmount } = getServiceUnitsAndAmount(s);
    subtotal = parseFloat((subtotal + amount).toFixed(2));
    totalGst  = parseFloat((totalGst  + gstAmount).toFixed(2));
    if (gstAmount > 0) {
      const r = Number(s.gstRate) || 0;
      gstBreakdown[r] = parseFloat(((gstBreakdown[r] || 0) + gstAmount).toFixed(2));
    }
  }
  return { subtotal, totalGst, grandTotal: parseFloat((subtotal + totalGst).toFixed(2)), gstBreakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function BillListPage() {
  // list
  const [data,           setData]           = useState<Bill[]>([]);
  const [total,          setTotal]          = useState(0);
  const [loading,        setLoading]        = useState(true);
  const [page,           setPage]           = useState(1);
  const [search,         setSearch]         = useState("");
  const [monthFilter,    setMonthFilter]    = useState("");
  const [yearFilter,     setYearFilter]     = useState("");
  const [fyFilter,       setFyFilter]       = useState("");
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [stats,          setStats]          = useState<BillStats | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  // modal
  const [modalOpen,      setModalOpen]      = useState(false);
  const [selectedBill,   setSelectedBill]   = useState<Bill | null>(null);
  const [nbMonth,        setNbMonth]        = useState("");
  const [nbYear,         setNbYear]         = useState(currentYear);
  const [nbInvoiceDate,  setNbInvoiceDate]  = useState(new Date().toISOString().split("T")[0]);
  const [nbDueDate,      setNbDueDate]      = useState("");
  const [nbServices,     setNbServices]     = useState<CustomerService[]>([]);
  const [lockedElecMode, setLockedElecMode] = useState<"reading" | "direct">("reading");
  const [lockedBillType, setLockedBillType] = useState<BillingType>("monthly");
  const [prevReading,    setPrevReading]    = useState<number | null>(null);
  const [modalLoading,   setModalLoading]   = useState(false);
  const [modalSaving,    setModalSaving]    = useState(false);

  // ── fetch list ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "20", search: debouncedSearch, status: "paid" });
      if (monthFilter && monthFilter !== "all") p.set("billingMonth",    monthFilter);
      if (yearFilter  && yearFilter  !== "all") p.set("billingYear",     yearFilter);
      if (fyFilter    && fyFilter    !== "all") p.set("financialYearId", fyFilter);
      const r = await fetch(`/api/bills?${p.toString()}`);
      if (!r.ok) { setData([]); setTotal(0); return; }
      const d = await r.json();
      setData(d.data ?? []); setTotal(d.total ?? 0);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setData([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, monthFilter, yearFilter, fyFilter]);

  const loadStats = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (monthFilter && monthFilter !== "all") p.set("billingMonth",    monthFilter);
      if (yearFilter  && yearFilter  !== "all") p.set("billingYear",     yearFilter);
      if (fyFilter    && fyFilter    !== "all") p.set("financialYearId", fyFilter);
      const qs = p.toString();
      const r  = await fetch(`/api/bills/stats${qs ? `?${qs}` : ""}`);
      if (!r.ok) return;
      const d  = await r.json();
      setStats(d.data);
    } catch { /* ignore */ }
  }, [monthFilter, yearFilter, fyFilter]);

  useEffect(() => { fetch("/api/financial-years").then(r=>r.json()).then(d=>setFinancialYears(d.data??[])); }, []);
  useEffect(() => { load(); },      [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // ─────────────────────────────────────────────────────────────────────────
  // Open modal — load client data, lock billing type + elec mode
  // ─────────────────────────────────────────────────────────────────────────
  async function openModal(bill: Bill) {
    setSelectedBill(bill);
    setModalSaving(false);
    setModalLoading(true);
    setModalOpen(true);

    const today = new Date().toISOString().split("T")[0];
    setNbInvoiceDate(today);
    const due = new Date(); due.setDate(due.getDate() + 15);
    setNbDueDate(due.toISOString().split("T")[0]);

    try {
      // Resolve customerId — list API returns populated object
      const customerIdRaw = bill.customerId;
      const customerId =
        typeof customerIdRaw === "object" && customerIdRaw !== null
          ? (customerIdRaw as { _id?: string })._id ?? String(customerIdRaw)
          : String(customerIdRaw);

      // 1. Full paid bill for accurate electricity item notes
      let fullBill = bill;
      try {
        const r = await fetch(`/api/bills/${bill._id}`);
        if (r.ok) { const j = await r.json(); if (j.data) fullBill = j.data; }
      } catch (e) { console.warn("[BillList] full-bill fetch:", e); }

      // 2. Customer master  →  { data: { customer, units, recentBills } }
      const custRes = await fetch(`/api/customers/${customerId}`);
      if (!custRes.ok) throw new Error(`Customer fetch failed: ${custRes.status}`);
      const custJson = await custRes.json();
      const customer = custJson.data?.customer ?? custJson.data;
      if (!customer) throw new Error("Customer data missing in API response");

      // 3. Lock billing frequency from master (set once at client creation)
      const billingType: BillingType = (customer.billingType as BillingType) ?? "monthly";
      setLockedBillType(billingType);

      // 4. Compute next period using locked frequency
      const next = getNextPeriod(bill.billingMonth, bill.billingYear, billingType);
      setNbMonth(next.month);
      setNbYear(next.year);

      // 5. Previous ending meter reading
      let prevEnd: number | null = null;
      try {
        const lr = await fetch(`/api/bills?lastReading=true&customerId=${customerId}`);
        const lj = await lr.json();
        if (lj.data?.previousEndReading != null) prevEnd = lj.data.previousEndReading;
      } catch (e) { console.warn("[BillList] last-reading fetch:", e); }

      // 6. Parse paid-bill electricity notes as fallback
      const paidElecItem = fullBill.items?.find(
        it => it.serviceName?.toLowerCase().includes("elec") ||
              it.calculationType === "METER" || it.unit?.toLowerCase() === "kwh"
      );
      if (paidElecItem && prevEnd === null) {
        const am = paidElecItem.notes?.match(/(?:->|→)\s*(\d+(?:\.\d+)?)/);
        const rm = paidElecItem.notes?.match(/Meter Reading:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
        if (am?.[1])        prevEnd = parseFloat(am[1]);
        else if (rm?.[1])   prevEnd = parseFloat(rm[1]);
      }

      // 7. Lock electricity mode
      const clientSvcs: CustomerService[] = customer?.services ?? [];
      const elecSvc = clientSvcs.find(s => (s.type||"").toLowerCase() === "electricity");
      let locked: "reading" | "direct" = "reading";
      if (elecSvc?.calculationMode) locked = elecSvc.calculationMode;
      else if (paidElecItem)
        locked = paidElecItem.calculationType === "METER" || paidElecItem.notes?.includes("Meter")
          ? "reading" : "direct";
      setLockedElecMode(locked);

      // 8. Fallback: customer stored reading
      if (prevEnd === null && elecSvc) {
        prevEnd = (elecSvc.currentReading  && elecSvc.currentReading  > 0 ? elecSvc.currentReading  : null)
               ?? (elecSvc.initialReading  && elecSvc.initialReading  > 0 ? elecSvc.initialReading  : null);
      }
      setPrevReading(prevEnd);

      // 9. Build service rows from customer master
      if (clientSvcs.length > 0) {
        setNbServices(clientSvcs.map(s => {
          const isElec = (s.type||"").toLowerCase() === "electricity";
          if (isElec) return {
            ...s, calculationMode: locked,
            initialReading: prevEnd != null ? prevEnd : (s.currentReading ?? s.initialReading ?? 0),
            currentReading: undefined,   // user must enter — never pre-fill to 0
            isTaxable: s.isTaxable ?? false, gstRate: s.gstRate ?? 0,
          };
          return { ...s, isTaxable: s.isTaxable ?? true, gstRate: s.gstRate ?? 18 };
        }));
      } else {
        setNbServices([{
          type: "electricity", calculationMode: locked,
          initialReading: prevEnd ?? 0, currentReading: undefined,
          rate: elecSvc?.rate ?? paidElecItem?.rate ?? 8,
          units: 0, isTaxable: false, gstRate: 0,
        }]);
      }
    } catch (err) {
      console.error("[BillList] openModal:", err);
      toast.error(err instanceof Error ? `Failed to load client: ${err.message}` : "Failed to load client details");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  }

  // ─── Service handlers ─────────────────────────────────────────────────────
  function svcChange(index: number, field: keyof CustomerService, value: unknown) {
    setNbServices(prev => {
      const copy = [...prev];
      const upd  = { ...copy[index], [field]: value };
      if (field === "type" && String(value).toLowerCase() === "electricity") {
        upd.calculationMode = lockedElecMode;
        if (lockedElecMode === "reading") { upd.initialReading = prevReading ?? 0; upd.currentReading = undefined; }
        upd.rate = upd.rate ?? 8; upd.isTaxable = upd.isTaxable ?? false; upd.gstRate = upd.gstRate ?? 0;
      }
      copy[index] = upd; return copy;
    });
  }
  const addService    = () => setNbServices(p => [...p, { type: "maintenance", rate: 0, units: 1, isTaxable: true, gstRate: 18 }]);
  const removeService = (i: number) => setNbServices(p => p.filter((_, idx) => idx !== i));

  // ─── Save ─────────────────────────────────────────────────────────────────
  async function saveNextBill() {
    if (!selectedBill) return;
    if (nbServices.length === 0) { toast.error("Please add at least one service."); return; }

    // Validate electricity readings
    for (const s of nbServices) {
      if ((s.type||"").toLowerCase() === "electricity" && s.calculationMode !== "direct") {
        const init = Number(s.initialReading) || 0;
        const curr = Number(s.currentReading);
        if (s.currentReading === undefined || isNaN(curr) || curr === 0) {
          toast.error("Please enter the Current / Final Reading for Electricity."); return;
        }
        if (curr < init) {
          toast.error("Current / Final Reading cannot be less than Initial / Start Reading."); return;
        }
      }
    }

    setModalSaving(true);
    try {
      const customerIdRaw = selectedBill.customerId;
      const customerId =
        typeof customerIdRaw === "object" && customerIdRaw !== null
          ? (customerIdRaw as { _id?: string })._id ?? String(customerIdRaw)
          : String(customerIdRaw);

      const unitIdRaw = selectedBill.unitId;
      const locIdRaw  = selectedBill.locationId;
      const unitId     = unitIdRaw ? (typeof unitIdRaw  === "object" ? (unitIdRaw  as { _id?: string })._id : String(unitIdRaw))  : undefined;
      const locationId = locIdRaw  ? (typeof locIdRaw   === "object" ? (locIdRaw   as { _id?: string })._id : String(locIdRaw))   : undefined;

      const services = nbServices.map(s => {
        const { units } = getServiceUnitsAndAmount(s);
        const isElec    = (s.type||"").toLowerCase() === "electricity";
        let notes = s.description ?? "";
        if (isElec && s.calculationMode !== "direct") {
          notes = `Meter: ${Number(s.initialReading)||0} → ${Number(s.currentReading)||0} = ${units} kWh`;
        }
        return {
          serviceId:       s.type,
          serviceName:     s.type.charAt(0).toUpperCase() + s.type.slice(1),
          serviceCode:     s.type.toUpperCase().slice(0, 4),
          calculationType: isElec ? "METER" : "QUANTITY_RATE",
          quantity:        units,
          unit:            isElec ? "kWh" : "unit",
          rate:            Number(s.rate) || 0,
          isTaxable:       s.isTaxable !== false,
          gstRate:         Number(s.gstRate) || 0,
          notes,
        };
      });

      const payload = {
        customerId,
        ...(unitId     ? { unitId }     : {}),
        ...(locationId ? { locationId } : {}),
        billingMonth: nbMonth,
        billingYear:  nbYear,
        invoiceDate:  nbInvoiceDate,
        dueDate:      nbDueDate,
        services,
        notes: `Generated from paid invoice ${selectedBill.invoiceNumber}`,
      };

      console.log("[BillList] POST payload:", JSON.stringify(payload, null, 2));

      const res  = await fetch("/api/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      // Read text first — avoids crash when server returns empty body on 500
      const text = await res.text();
      let json: { data?: { invoiceNumber: string }; error?: string } = {};
      try { json = text ? JSON.parse(text) : {}; } catch { /* malformed JSON — keep empty */ }
      if (!res.ok) {
        console.error("[BillList] API error:", json);
        toast.error(json.error || `Failed to generate bill (HTTP ${res.status})`);
        return;
      }
      toast.success(`New bill created: ${json.data?.invoiceNumber} — Paid bill (${selectedBill.invoiceNumber}) remains untouched.`);
      setModalOpen(false);
      load();
    } catch (err) {
      console.error("[BillList] saveNextBill:", err);
      toast.error(err instanceof Error ? `Error: ${err.message}` : "Something went wrong while generating the next bill.");
    } finally {
      setModalSaving(false);
    }
  }

  const totals = useMemo(() => calcTotals(nbServices), [nbServices]);

  // ─── Table columns ────────────────────────────────────────────────────────
  const columns: Column<Record<string, unknown>>[] = [
    { key: "invoiceNumber", label: "Invoice No",
      render: v => <span className="font-mono font-semibold text-xs">{String(v)}</span> },
    { key: "customerId", label: "Customer",
      render: v => {
        const c = v as { name: string; customerId: string; mobile?: string };
        return <div><div className="font-medium text-xs">{c?.name??""}</div><div className="text-[11px] text-muted-foreground">{c?.mobile??c?.customerId??""}</div></div>;
      }},
    { key: "unitId", label: "Unit", render: v => (v as {unitCode:string}|null)?.unitCode??"—" },
    { key: "billingMonth", label: "Period",
      render: (v, row) => <div className="text-xs"><div className="font-medium">{String(v)}</div><div className="text-muted-foreground">{(row as unknown as Bill).billingYear}</div></div> },
    { key: "grandTotal",        label: "Total",       render: v => <span className="font-semibold text-xs">{formatCurrency(v as number)}</span> },
    { key: "paidAmount",        label: "Paid",        render: v => <span className="text-xs text-emerald-600">{formatCurrency(v as number)}</span> },
    { key: "outstandingAmount", label: "Outstanding", render: v => <span className={(v as number)>0?"text-orange-600 font-semibold text-xs":"text-xs text-muted-foreground"}>{formatCurrency(v as number)}</span> },
    { key: "status", label: "Status",
      render: v => <Badge variant={statusVariants[v as string]??"secondary"} className="text-[10px]">{String(v).replace("_"," ")}</Badge> },
    { key: "dueDate", label: "Due Date",
      render: (v, row) => {
        const due = new Date(v as string);
        const isOverdue = due < new Date() && (row as unknown as Bill).status !== "paid" && (row as unknown as Bill).status !== "cancelled";
        return <div className="flex items-center gap-1">{isOverdue&&<AlertCircle className="h-3 w-3 text-red-500"/>}<span className={isOverdue?"text-red-600 font-semibold text-xs":"text-xs"}>{formatDate(v as string)}</span></div>;
      }},
    { key: "_id", label: "Actions", className: "text-right w-24",
      render: (_, row) => {
        const bill = row as unknown as Bill;
        return (
          <div className="flex items-center justify-end gap-1">
            <Link href={`/transactions/bills/${bill._id}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors" title="View Invoice">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
            <button type="button" title="Update Services & Generate Next Bill"
              onClick={() => openModal(bill)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-primary/10 transition-colors">
              <Pencil className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>
        );
      }},
  ];

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="Bill List" description="Complete paid bill management and overview" />

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Bills",  value: stats?.totalBills??0,                                         icon: <FileText    className="h-5 w-5"/>, bg: "bg-blue-50   text-blue-600"    },
          { label: "Paid",         value: stats?.paidCount??0,                                          icon: <CheckCircle2 className="h-5 w-5"/>, bg: "bg-emerald-50 text-emerald-600", cls: "text-emerald-600" },
          { label: "Unpaid",       value: (stats?.unpaidCount??0)+(stats?.partiallyPaidCount??0),       icon: <Clock       className="h-5 w-5"/>, bg: "bg-amber-50  text-amber-600",   cls: "text-amber-600"   },
          { label: "Overdue",      value: stats?.overdueCount??0,                                       icon: <AlertCircle className="h-5 w-5"/>, bg: "bg-red-50    text-red-600",     cls: "text-red-600"     },
          { label: "Outstanding",  value: formatCurrency(stats?.totalOutstanding??0), isAmt: true,      icon: <XCircle     className="h-5 w-5"/>, bg: "bg-orange-50 text-orange-600",  cls: "text-red-600 text-xl" },
        ].map(({ label, value, icon, bg, cls, isAmt }) => (
          <div key={label} className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">{label}</span>
              <div className={`font-bold mt-1 ${cls ?? "text-foreground"} ${isAmt ? "text-xl" : "text-2xl"}`}>{value}</div>
            </div>
            <div className={`p-2.5 rounded-lg ${bg}`}>{icon}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All months"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All years"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {financialYears.length > 0 && (
          <Select value={fyFilter} onValueChange={setFyFilter}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All financial years"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All FY</SelectItem>
              {financialYears.map(fy => <SelectItem key={fy._id} value={fy._id}>{fy.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading} totalCount={total} page={page} pageSize={20}
        onPageChange={setPage} searchValue={search} onSearchChange={setSearch}
        searchPlaceholder="Search invoice number..." emptyMessage="No paid bills found."
      />

      {/* ════════════════════════════════════════════════════════════════════
          MODAL — Generate Next Bill  (paid bill is NEVER modified)
          ════════════════════════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl">

          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FilePlus2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Generate Next Bill{selectedBill?.customerId?.name ? ` — ${selectedBill.customerId.name}` : ""}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update services, carry forward meter readings, and create the next bill.{" "}
                  <span className="font-semibold text-emerald-700">
                    Paid bill ({selectedBill?.invoiceNumber}) stays untouched.
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {modalLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
                <p className="text-xs text-slate-500 animate-pulse">Loading client profile &amp; reading history…</p>
              </div>
            ) : (
              <>
                {/* Lock badges */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-900">
                    <Lock className="h-3 w-3 text-sky-600" />
                    <CalendarClock className="h-3.5 w-3.5 text-sky-600" />
                    <span>Billing Frequency (Locked):</span>
                    <span className="font-extrabold underline ml-0.5">{BILLING_TYPE_LABELS[lockedBillType]}</span>
                  </div>
                </div>

                {/* Period + dates */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Billing Month — locked, read-only */}
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      Billing Month
                      <Lock className="h-2.5 w-2.5 text-slate-400"/>
                    </Label>
                    <div className="mt-1 h-8 px-2.5 flex items-center rounded-md border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700 select-none cursor-not-allowed">
                      {nbMonth}
                    </div>
                  </div>
                  {/* Billing Year — locked, read-only */}
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      Billing Year
                      <Lock className="h-2.5 w-2.5 text-slate-400"/>
                    </Label>
                    <div className="mt-1 h-8 px-2.5 flex items-center rounded-md border border-slate-200 bg-slate-100 text-xs font-bold font-mono text-slate-700 select-none cursor-not-allowed">
                      {nbYear}
                    </div>
                  </div>
                  {/* Invoice Date — editable */}
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Invoice Date</Label>
                    <Input type="date" className="mt-1 h-8 text-xs bg-white" value={nbInvoiceDate} onChange={e=>setNbInvoiceDate(e.target.value)}/>
                  </div>
                  {/* Due Date — editable */}
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Due Date</Label>
                    <Input type="date" className="mt-1 h-8 text-xs bg-white" value={nbDueDate} onChange={e=>setNbDueDate(e.target.value)}/>
                  </div>
                </div>

                {/* Services header */}
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary"/>
                    Services for {nbMonth} {nbYear}
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={addService}
                    className="h-7 text-xs bg-white border-primary/30 text-primary hover:bg-primary/5">
                    <Plus className="h-3.5 w-3.5 mr-1"/> Add Service
                  </Button>
                </div>

                {/* Service rows */}
                <div className="space-y-3">
                  {nbServices.map((svc, idx) => {
                    const isElec    = (svc.type||"").toLowerCase() === "electricity";
                    const isReadMode = svc.calculationMode !== "direct";
                    const { units: calcUnits } = getServiceUnitsAndAmount(svc);
                    return (
                      <div key={idx} className={`p-3.5 rounded-xl border transition-all ${isElec ? "border-amber-300/80 bg-amber-50/20 shadow-xs" : "border-slate-200 bg-white shadow-2xs"}`}>

                        {/* Row header */}
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isElec?"bg-amber-100 text-amber-800":"bg-slate-100 text-slate-700"}`}>{idx+1}</span>
                            <span className="font-bold text-xs capitalize text-slate-900 flex items-center gap-1">
                              {isElec && <Zap className="h-3.5 w-3.5 text-amber-500"/>}
                              {svc.type||"Service"}
                            </span>
                          </div>
                          {nbServices.length > 1 && (
                            <Button type="button" variant="ghost" size="icon-sm"
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              onClick={()=>removeService(idx)} title="Remove service">
                              <Trash2 className="h-3.5 w-3.5"/>
                            </Button>
                          )}
                        </div>

                        {/* Type + non-electricity inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2.5">
                          <div>
                            <Label className="text-xs text-slate-700 font-semibold">Service Type</Label>
                            <select value={(svc.type||"maintenance").toLowerCase()} onChange={e=>svcChange(idx,"type",e.target.value)}
                              className="mt-1 w-full h-8 border border-slate-200 rounded-md px-2.5 text-xs bg-white font-medium capitalize">
                              {serviceTypes.map(st=><option key={st.value} value={st.value}>{st.label}</option>)}
                            </select>
                          </div>
                          {!isElec && <>
                            <div>
                              <Label className="text-xs text-slate-700 font-semibold">Rate (₹)</Label>
                              <Input type="number" min="0" step="any" className="mt-1 h-8 text-xs bg-white"
                                value={svc.rate||""} onChange={e=>svcChange(idx,"rate",parseFloat(e.target.value)||0)} placeholder="0.00"/>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-700 font-semibold">Units / Qty</Label>
                              <Input type="number" min="0" step="any" className="mt-1 h-8 text-xs bg-white"
                                value={svc.units||""} onChange={e=>svcChange(idx,"units",parseFloat(e.target.value)||0)} placeholder="1"/>
                            </div>
                          </>}
                        </div>

                        {/* Non-electricity GST */}
                        {!isElec && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                              <Label className="text-[11px] font-semibold text-slate-700">Apply GST</Label>
                              <button type="button" onClick={()=>svcChange(idx,"isTaxable",!(svc.isTaxable!==false))}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${svc.isTaxable!==false?"bg-emerald-600":"bg-slate-300"}`}>
                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${svc.isTaxable!==false?"translate-x-5":"translate-x-1"}`}/>
                              </button>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-700 font-semibold">GST Slab (%)</Label>
                              <select value={String(Number(svc.gstRate)||0)} onChange={e=>svcChange(idx,"gstRate",parseFloat(e.target.value)||0)}
                                disabled={svc.isTaxable===false}
                                className="mt-1 w-full h-8 border rounded-md px-2 text-xs bg-white font-semibold disabled:opacity-50">
                                {GST_SLABS.map(s=><option key={s} value={s}>{s===0?"0% (Exempt)":`${s}%`}</option>)}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-700 font-semibold">Line Total</Label>
                              <div className="mt-1 h-8 px-2 flex items-center rounded-md bg-primary/5 border border-primary/20 font-mono font-bold text-xs text-primary">
                                {formatCurrency(getServiceUnitsAndAmount(svc).totalAmount)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Electricity locked dual-mode */}
                        {isElec && (
                          <div className="space-y-3 pt-2 border-t border-amber-200">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-xs font-bold text-amber-950">
                              <Lock className="h-3.5 w-3.5 text-amber-700"/>
                              <span>Fixed Mode Policy (Locked for this client):</span>
                              <span className="font-extrabold underline ml-1">
                                {isReadMode ? "Mode 1: Meter Reading Difference" : "Mode 2: Direct Consumed Units"}
                              </span>
                            </div>

                            {isReadMode ? (
                              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center flex-wrap gap-1">
                                      Initial / Start Reading (kWh)
                                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.5 rounded">Auto-Fetched</span>
                                    </Label>
                                    <Input type="number" step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold bg-emerald-50/50 border-emerald-300"
                                      value={svc.initialReading??""} placeholder="e.g. 1200"
                                      onChange={e=>svcChange(idx,"initialReading",parseFloat(e.target.value)||0)}/>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Previous bill ending reading (auto-populated)</span>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">Current / Final Reading (kWh) *</Label>
                                    <Input type="number" step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500"
                                      value={svc.currentReading??""} placeholder="e.g. 1350"
                                      onChange={e=>{
                                        const v = e.target.value;
                                        svcChange(idx,"currentReading", v===""?undefined:parseFloat(v));
                                      }}/>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Enter current month ending reading</span>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">Rate per Unit (₹/kWh) *</Label>
                                    <Input type="number" step="any" className="mt-1 h-9 text-xs font-mono font-bold bg-white"
                                      value={svc.rate||""} placeholder="e.g. 8.00"
                                      onChange={e=>svcChange(idx,"rate",parseFloat(e.target.value)||0)}/>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Unit charge in Rupees</span>
                                  </div>
                                </div>
                                {/* Live usage */}
                                <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-amber-950 font-medium">
                                    Usage: <span className="font-mono font-bold">{svc.currentReading??0} − {svc.initialReading??0} = <span className="text-primary text-sm font-extrabold">{calcUnits} kWh</span></span>
                                  </span>
                                  <span className="font-bold text-slate-900 flex flex-wrap items-center gap-3">
                                    <span>Base: <span className="font-mono text-amber-900">{formatCurrency(getServiceUnitsAndAmount(svc).amount)}</span></span>
                                    <span>GST {Number(svc.gstRate)||0}%: <span className="font-mono text-emerald-700">+{formatCurrency(getServiceUnitsAndAmount(svc).gstAmount)}</span></span>
                                    <span>Total: <span className="text-primary font-mono text-sm ml-1">{formatCurrency(getServiceUnitsAndAmount(svc).totalAmount)}</span></span>
                                  </span>
                                </div>
                                {/* GST mode 1 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <Receipt className="h-3.5 w-3.5 text-sky-600"/>
                                      <Label className="text-[11px] font-semibold text-slate-700">Apply GST</Label>
                                    </div>
                                    <button type="button" onClick={()=>svcChange(idx,"isTaxable",!(svc.isTaxable!==false))}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${svc.isTaxable!==false?"bg-emerald-600":"bg-slate-300"}`}>
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${svc.isTaxable!==false?"translate-x-5":"translate-x-1"}`}/>
                                    </button>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">GST Slab (%)</Label>
                                    <select value={String(Number(svc.gstRate)||0)} onChange={e=>svcChange(idx,"gstRate",parseFloat(e.target.value)||0)}
                                      disabled={svc.isTaxable===false}
                                      className={`mt-1 w-full h-8 border rounded-md px-2 text-xs font-semibold ${svc.isTaxable===false?"bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed":"bg-white border-slate-200 text-slate-800"}`}>
                                      {GST_SLABS.map(s=><option key={s} value={s}>{s===0?"0% (Exempt)":`${s}%`}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <Calculator className="h-3 w-3 text-slate-400"/>Line Total (incl. GST)
                                    </Label>
                                    <div className="mt-1 h-8 px-2 flex items-center rounded-md bg-primary/5 border border-primary/20">
                                      <span className="text-xs font-bold text-primary font-mono tabular-nums">{formatCurrency(getServiceUnitsAndAmount(svc).totalAmount)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Mode 2 */
                              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">Direct Consumed Units (kWh) *</Label>
                                    <Input type="number" step="any" className="mt-1 h-9 text-xs font-mono font-bold"
                                      value={svc.units||""} placeholder="e.g. 20"
                                      onChange={e=>svcChange(idx,"units",parseFloat(e.target.value)||0)}/>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Direct meter units consumed</span>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">Rate per Unit (₹/kWh) *</Label>
                                    <Input type="number" step="any" className="mt-1 h-9 text-xs font-mono font-bold"
                                      value={svc.rate||""} placeholder="e.g. 8.00"
                                      onChange={e=>svcChange(idx,"rate",parseFloat(e.target.value)||0)}/>
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">Unit charge in Rupees</span>
                                  </div>
                                </div>
                                <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-amber-950 font-medium">Formula: {svc.units||0} kWh × ₹{svc.rate||0}</span>
                                  <span className="font-bold text-slate-900 flex flex-wrap items-center gap-3">
                                    <span>Base: <span className="font-mono text-amber-900">{formatCurrency(getServiceUnitsAndAmount(svc).amount)}</span></span>
                                    <span>GST {Number(svc.gstRate)||0}%: <span className="font-mono text-emerald-700">+{formatCurrency(getServiceUnitsAndAmount(svc).gstAmount)}</span></span>
                                    <span>Total: <span className="text-primary font-mono text-sm ml-1">{formatCurrency(getServiceUnitsAndAmount(svc).totalAmount)}</span></span>
                                  </span>
                                </div>
                                {/* GST mode 2 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <Receipt className="h-3.5 w-3.5 text-sky-600"/>
                                      <Label className="text-[11px] font-semibold text-slate-700">Apply GST</Label>
                                    </div>
                                    <button type="button" onClick={()=>svcChange(idx,"isTaxable",!(svc.isTaxable!==false))}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${svc.isTaxable!==false?"bg-emerald-600":"bg-slate-300"}`}>
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${svc.isTaxable!==false?"translate-x-5":"translate-x-1"}`}/>
                                    </button>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">GST Slab (%)</Label>
                                    <select value={String(Number(svc.gstRate)||0)} onChange={e=>svcChange(idx,"gstRate",parseFloat(e.target.value)||0)}
                                      disabled={svc.isTaxable===false}
                                      className={`mt-1 w-full h-8 border rounded-md px-2 text-xs font-semibold ${svc.isTaxable===false?"bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed":"bg-white border-slate-200 text-slate-800"}`}>
                                      {GST_SLABS.map(s=><option key={s} value={s}>{s===0?"0% (Exempt)":`${s}%`}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <Calculator className="h-3 w-3 text-slate-400"/>Line Total (incl. GST)
                                    </Label>
                                    <div className="mt-1 h-8 px-2 flex items-center rounded-md bg-primary/5 border border-primary/20">
                                      <span className="text-xs font-bold text-primary font-mono tabular-nums">{formatCurrency(getServiceUnitsAndAmount(svc).totalAmount)}</span>
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
                </div>

                {/* Bill summary */}
                <div className="mt-2 p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Bill Summary</p>
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {Object.entries(totals.gstBreakdown).map(([rate, amt]) => (
                    <div key={rate} className="flex justify-between text-xs text-slate-600">
                      <span>GST @ {rate}%</span><span className="font-mono">+{formatCurrency(amt)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-primary/20 pt-1.5">
                    <span>Grand Total</span>
                    <span className="font-mono text-primary">{formatCurrency(totals.grandTotal)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500 flex-1">
              A new bill will be created for{" "}
              <span className="font-semibold text-slate-700">{nbMonth} {nbYear}</span>.
              The original paid bill is permanently preserved.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={()=>setModalOpen(false)} disabled={modalSaving}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveNextBill} disabled={modalSaving||modalLoading} className="min-w-[130px]">
                {modalSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin"/>Generating…</>
                ) : (
                  <><FilePlus2 className="h-3.5 w-3.5 mr-1.5"/>Generate Bill</>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
