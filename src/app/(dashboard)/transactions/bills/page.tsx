"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertCircle,
  CircleDollarSign,
  Clock,
  Eye,
  FileCheck2,
  FilePlus,
  Receipt,
  Search,
  CreditCard,
  Pencil,
  Plus,
  Trash2,
  Gauge,
  Zap,
  Calculator,
  Calendar,
  Layers,
  Sparkles,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const serviceTypes = [
  { value: "security", label: "Security" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "maintenance", label: "Maintenance" },
  { value: "others", label: "Others" },
];

const GST_SLABS = [0, 5, 12, 18, 28];

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
  customerId: { _id?: string; name: string; customerId: string };
  unitId?: { _id?: string; unitCode: string };
  locationId?: { _id?: string; name: string };
  invoiceDate: string;
  dueDate: string;
  grandTotal: number;
  subtotal?: number;
  taxableAmount?: number;
  totalGst?: number;
  otherCharges?: number;
  discount?: number;
  roundOff?: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  billingMonth: string;
  billingYear: number;
  items?: BillItem[];
}

const statusVariants: Record<string, "default" | "success" | "warning" | "destructive" | "muted" | "info"> = {
  unpaid: "warning",
  partially_paid: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "muted",
};

type TabKey = "new" | "paid" | "partial" | "all";

const TAB_META: Record<TabKey, { label: string; statuses: string[]; icon: typeof FileCheck2; accent: string; ring: string }> = {
  new: {
    label: "New Bills",
    statuses: ["unpaid", "overdue"],
    icon: Clock,
    accent: "from-orange-50 to-amber-50 border-orange-200 text-orange-700",
    ring: "ring-orange-200/60",
  },
  paid: {
    label: "Paid Bills",
    statuses: ["paid"],
    icon: FileCheck2,
    accent: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    ring: "ring-emerald-200/60",
  },
  partial: {
    label: "Partially Paid",
    statuses: ["partially_paid"],
    icon: CircleDollarSign,
    accent: "from-sky-50 to-blue-50 border-sky-200 text-sky-700",
    ring: "ring-sky-200/60",
  },
  all: {
    label: "All",
    statuses: [],
    icon: Receipt,
    accent: "from-slate-50 to-zinc-50 border-slate-200 text-slate-700",
    ring: "ring-slate-200/60",
  },
};

function getNextPeriod(month: string, year: number) {
  const idx = MONTHS.indexOf(month);
  if (idx === -1) return { month: MONTHS[new Date().getMonth()], year };
  if (idx === 11) return { month: MONTHS[0], year: year + 1 };
  return { month: MONTHS[idx + 1], year };
}

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
  const gstAmount = isTaxable && gstRate > 0 ? parseFloat(((amount * gstRate) / 100).toFixed(2)) : 0;
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

export default function BillsPage() {
  const router = useRouter();
  const [data, setData] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<TabKey>("new");
  const debouncedInvoiceSearch = useDebounce(invoiceSearch, 400);
  const debouncedClientSearch = useDebounce(clientSearch, 400);

  // Unpaid Bill Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [editItems, setEditItems] = useState<BillItem[]>([]);
  const [editOtherCharges, setEditOtherCharges] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editSaving, setEditSaving] = useState(false);

  // Paid Bill -> Next Month Bill Modal State (Client-Specific)
  const [nextBillModalOpen, setNextBillModalOpen] = useState(false);
  const [selectedPaidBill, setSelectedPaidBill] = useState<Bill | null>(null);
  const [nextBillMonth, setNextBillMonth] = useState("");
  const [nextBillYear, setNextBillYear] = useState(new Date().getFullYear());
  const [nextBillInvoiceDate, setNextBillInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextBillDueDate, setNextBillDueDate] = useState("");
  const [nextBillServices, setNextBillServices] = useState<CustomerService[]>([]);
  const [clientLockedElecMode, setClientLockedElecMode] = useState<"reading" | "direct">("reading");
  const [clientPreviousReading, setClientPreviousReading] = useState<number | null>(null);
  const [nextBillLoading, setNextBillLoading] = useState(false);
  const [nextBillSaving, setNextBillSaving] = useState(false);

  const aggregate = useMemo(() => {
    const totals: Record<string, { count: number; amount: number }> = {
      new: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 },
      partial: { count: 0, amount: 0 },
      all: { count: 0, amount: 0 },
    };
    for (const b of data) {
      const gt = Number(b.grandTotal) || 0;
      totals.all.count += 1;
      totals.all.amount += gt;
      if (b.status === "unpaid" || b.status === "overdue") {
        totals.new.count += 1;
        totals.new.amount += gt;
      } else if (b.status === "paid") {
        totals.paid.count += 1;
        totals.paid.amount += gt;
      } else if (b.status === "partially_paid") {
        totals.partial.count += 1;
        totals.partial.amount += gt;
      }
    }
    return totals;
  }, [data]);

  const effectiveStatus = useMemo(() => {
    if (statusFilter) return statusFilter;
    return TAB_META[tab].statuses.join(",");
  }, [tab, statusFilter]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      let url = `/api/bills?page=${page}&limit=20`;
      if (debouncedInvoiceSearch) url += `&search=${encodeURIComponent(debouncedInvoiceSearch)}`;
      if (debouncedClientSearch) url += `&clientSearch=${encodeURIComponent(debouncedClientSearch)}`;
      if (effectiveStatus) url += `&status=${encodeURIComponent(effectiveStatus)}`;
      const r = await fetch(url, { signal });
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
  }, [debouncedInvoiceSearch, debouncedClientSearch, page, effectiveStatus]);

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, debouncedInvoiceSearch, debouncedClientSearch]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  // Handle opening next month bill modal for a Paid bill
  async function openNextBillModal(bill: Bill) {
    setSelectedPaidBill(bill);
    setNextBillLoading(true);
    setNextBillModalOpen(true);

    const nextPeriod = getNextPeriod(bill.billingMonth, bill.billingYear);
    setNextBillMonth(nextPeriod.month);
    setNextBillYear(nextPeriod.year);

    const todayStr = new Date().toISOString().split("T")[0];
    setNextBillInvoiceDate(todayStr);

    const due = new Date();
    due.setDate(due.getDate() + 15);
    setNextBillDueDate(due.toISOString().split("T")[0]);

    try {
      const customerId = bill.customerId?._id || (bill.customerId as unknown as string);

      // 1. Fetch full bill to ensure all items and readings of the selected paid bill are loaded
      let fullPaidBill = bill;
      try {
        const billRes = await fetch(`/api/bills/${bill._id}`);
        if (billRes.ok) {
          const billJson = await billRes.json();
          if (billJson.data) fullPaidBill = billJson.data;
        }
      } catch (err) {
        console.warn("Could not fetch full bill, using row data", err);
      }

      // 2. Fetch client master details to get locked mode and default services
      const custRes = await fetch(`/api/customers/${customerId}`);
      const custJson = await custRes.json();
      const customer = custJson.data?.customer || custJson.data;

      // 3. Fetch latest ending meter reading via API
      let previousEndReading: number | null = null;
      try {
        const lastReadingRes = await fetch(`/api/bills?lastReading=true&customerId=${customerId}`);
        const lastReadingJson = await lastReadingRes.json();
        if (lastReadingJson.data?.previousEndReading !== null && lastReadingJson.data?.previousEndReading !== undefined) {
          previousEndReading = lastReadingJson.data.previousEndReading;
        }
      } catch (err) {
        console.warn("Could not fetch last reading via API", err);
      }

      // 4. Also inspect the selected paid bill's own items directly
      const paidElecItem = fullPaidBill.items?.find(
        (it) =>
          it.serviceName?.toLowerCase().includes("elec") ||
          it.calculationType === "METER" ||
          it.unit?.toLowerCase() === "kwh"
      );
      if (paidElecItem) {
        const arrowMatch = paidElecItem.notes?.match(/(?:->|→)\s*(\d+(?:\.\d+)?)/);
        const readingMatch = paidElecItem.notes?.match(/Meter Reading:\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
        if (arrowMatch?.[1]) {
          previousEndReading = parseFloat(arrowMatch[1]);
        } else if (readingMatch?.[1]) {
          previousEndReading = parseFloat(readingMatch[1]);
        }
      }

      // 5. Determine client's fixed electricity mode
      let lockedMode: "reading" | "direct" = "reading";
      const clientServices: CustomerService[] = customer?.services || [];
      const elecService = clientServices.find(
        (s) => (s.type || "").toLowerCase() === "electricity"
      );

      if (elecService?.calculationMode) {
        lockedMode = elecService.calculationMode;
      } else if (paidElecItem) {
        lockedMode = (paidElecItem.calculationType === "METER" || paidElecItem.notes?.includes("Meter")) ? "reading" : "direct";
      }
      setClientLockedElecMode(lockedMode);

      // Fallback to customer's currentReading or initialReading if reading still null
      if (previousEndReading === null && elecService) {
        if (elecService.currentReading) {
          previousEndReading = elecService.currentReading;
        } else if (elecService.initialReading) {
          previousEndReading = elecService.initialReading;
        }
      }
      setClientPreviousReading(previousEndReading);

      // Build initial services list for next month
      if (clientServices.length > 0) {
        const preparedServices = clientServices.map((s) => {
          const isElec = (s.type || "").toLowerCase() === "electricity";
          if (isElec) {
            return {
              ...s,
              calculationMode: lockedMode,
              // Pre-fill initial reading with previous bill's final reading
              initialReading: previousEndReading !== null ? previousEndReading : (s.currentReading || s.initialReading || 0),
              currentReading: 0,
              isTaxable: s.isTaxable !== undefined ? s.isTaxable : false,
              gstRate: s.gstRate !== undefined ? s.gstRate : 0,
            };
          }
          return {
            ...s,
            isTaxable: s.isTaxable !== undefined ? s.isTaxable : true,
            gstRate: s.gstRate !== undefined ? s.gstRate : 18,
          };
        });
        setNextBillServices(preparedServices);
      } else {
        // Fallback default services based on paid bill items or standard setup
        setNextBillServices([
          {
            type: "electricity",
            calculationMode: lockedMode,
            initialReading: previousEndReading !== null ? previousEndReading : 0,
            currentReading: 0,
            rate: elecService?.rate || paidElecItem?.rate || 8,
            units: 0,
            isTaxable: false,
            gstRate: 0,
          },
        ]);
      }
    } catch {
      toast.error("Failed to load client details for next billing");
    } finally {
      setNextBillLoading(false);
    }
  }

  function handleNextBillServiceChange(index: number, field: keyof CustomerService, value: unknown) {
    setNextBillServices((prev) => {
      const copy = [...prev];
      const updated = { ...copy[index], [field]: value };
      if (field === "type" && String(value).toLowerCase() === "electricity") {
        updated.calculationMode = clientLockedElecMode;
        if (clientLockedElecMode === "reading") {
          updated.initialReading = clientPreviousReading !== null ? clientPreviousReading : 0;
          updated.currentReading = 0;
        }
        updated.rate = updated.rate || 8;
        updated.isTaxable = updated.isTaxable !== undefined ? updated.isTaxable : false;
        updated.gstRate = updated.gstRate !== undefined ? updated.gstRate : 0;
      }
      copy[index] = updated;
      return copy;
    });
  }

  function handleAddNextBillService() {
    setNextBillServices((prev) => [
      ...prev,
      {
        type: "maintenance",
        rate: 0,
        units: 1,
        isTaxable: true,
        gstRate: 18,
      },
    ]);
  }

  function handleRemoveNextBillService(index: number) {
    setNextBillServices((prev) => prev.filter((_, i) => i !== index));
  }

  // Generate and save the next month's bill (creates a brand new document in DB)
  async function handleSaveNextMonthBill() {
    if (!selectedPaidBill) return;
    if (nextBillServices.length === 0) {
      toast.error("Please add at least one service for the new bill.");
      return;
    }

    // Validate electricity reading if in reading mode
    for (const s of nextBillServices) {
      if ((s.type || "").toLowerCase() === "electricity" && s.calculationMode !== "direct") {
        const init = Number(s.initialReading) || 0;
        const curr = Number(s.currentReading) || 0;
        if (curr < init) {
          toast.error("Current / Final Reading cannot be less than Initial / Start Reading.");
          return;
        }
      }
    }

    setNextBillSaving(true);
    try {
      const customerId = selectedPaidBill.customerId?._id || (selectedPaidBill.customerId as unknown as string);

      // Map to services payload expected by POST /api/bills
      const servicesPayload = nextBillServices.map((s) => {
        const { units, amount, gstAmount, totalAmount } = getServiceUnitsAndAmount(s);
        const isElec = (s.type || "").toLowerCase() === "electricity";
        let notes = s.description || "";
        if (isElec && s.calculationMode !== "direct") {
          const init = Number(s.initialReading) || 0;
          const curr = Number(s.currentReading) || 0;
          notes = `Meter: ${init} → ${curr} = ${units} kWh`;
        }

        return {
          serviceId: s.type,
          serviceName: s.type.charAt(0).toUpperCase() + s.type.slice(1),
          serviceCode: s.type.toUpperCase().slice(0, 4),
          calculationType: isElec ? "METER" : "QUANTITY_RATE",
          quantity: units,
          unit: isElec ? "kWh" : "unit",
          rate: Number(s.rate) || 0,
          isTaxable: s.isTaxable !== false,
          gstRate: Number(s.gstRate) || 0,
          notes,
        };
      });

      const payload = {
        customerId,
        unitId: selectedPaidBill.unitId?._id || undefined,
        locationId: selectedPaidBill.locationId?._id || undefined,
        billingMonth: nextBillMonth,
        billingYear: nextBillYear,
        invoiceDate: nextBillInvoiceDate,
        dueDate: nextBillDueDate,
        services: servicesPayload,
        notes: `Generated next month bill following paid invoice ${selectedPaidBill.invoiceNumber}`,
      };

      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to generate next bill");
        return;
      }

      toast.success(
        `Next month bill generated: ${json.data.invoiceNumber}! The paid bill (${selectedPaidBill.invoiceNumber}) remains untouched.`
      );
      setNextBillModalOpen(false);
      setTab("new");
      load();
    } catch {
      toast.error("Something went wrong while generating next bill");
    } finally {
      setNextBillSaving(false);
    }
  }

  // Edit Unpaid Bill Modal Handlers
  async function openEditModal(bill: Bill) {
    try {
      const res = await fetch(`/api/bills/${bill._id}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error("Failed to fetch bill details");
        return;
      }
      const fullBill: Bill = json.data;
      setEditingBill(fullBill);
      setEditItems(fullBill.items || []);
      setEditOtherCharges(fullBill.otherCharges || 0);
      setEditDiscount(fullBill.discount || 0);
      setEditModalOpen(true);
    } catch {
      toast.error("Error loading bill");
    }
  }

  function handleItemChange(idx: number, field: keyof BillItem, val: string | number) {
    setEditItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[idx], [field]: val };

      if (field === "rate" || field === "quantity" || field === "gstRate") {
        const qty = Number(it.quantity) || 0;
        const rt = Number(it.rate) || 0;
        const gstRt = it.isTaxable ? Number(it.gstRate) || 0 : 0;
        it.amount = parseFloat((qty * rt).toFixed(2));
        it.gstAmount = parseFloat(((it.amount * gstRt) / 100).toFixed(2));
        it.totalAmount = parseFloat((it.amount + it.gstAmount).toFixed(2));
      }
      copy[idx] = it;
      return copy;
    });
  }

  function handleAddItem() {
    setEditItems((prev) => [
      ...prev,
      {
        serviceName: "Water Charge",
        quantity: 1,
        unit: "month",
        rate: 0,
        amount: 0,
        isTaxable: false,
        gstRate: 0,
        gstAmount: 0,
        totalAmount: 0,
        notes: "",
      },
    ]);
  }

  function handleRemoveItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const editComputed = useMemo(() => {
    const subtotal = parseFloat(editItems.reduce((acc, i) => acc + (Number(i.amount) || 0), 0).toFixed(2));
    const totalGst = parseFloat(editItems.reduce((acc, i) => acc + (Number(i.gstAmount) || 0), 0).toFixed(2));
    const taxableAmount = Math.max(0, subtotal - editDiscount);
    const grandTotal = parseFloat((taxableAmount + totalGst + editOtherCharges).toFixed(2));
    return { subtotal, totalGst, taxableAmount, grandTotal };
  }, [editItems, editDiscount, editOtherCharges]);

  async function handleSaveEdit() {
    if (!editingBill) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/bills/${editingBill._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems,
          subtotal: editComputed.subtotal,
          taxableAmount: editComputed.taxableAmount,
          totalGst: editComputed.totalGst,
          otherCharges: editOtherCharges,
          discount: editDiscount,
          grandTotal: editComputed.grandTotal,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Failed to update bill");
        return;
      }
      toast.success("Bill updated successfully!");
      setEditModalOpen(false);
      load();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setEditSaving(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "invoiceNumber",
      label: "Invoice No",
      className: "font-mono font-semibold text-xs text-slate-800 w-36",
    },
    {
      key: "customerId",
      label: "Client",
      render: (v) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">
            {(v as { name: string })?.name ?? "-"}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            {(v as { customerId: string })?.customerId ?? ""}
          </div>
        </div>
      ),
    },
    { key: "billingMonth", label: "Period", render: (v, row) => `${v} ${(row as unknown as Bill).billingYear}` },
    { key: "invoiceDate", label: "Date", render: (v) => formatDate(v as string) },
    {
      key: "grandTotal",
      label: "Total",
      render: (v) => (
        <span className="font-mono font-bold text-slate-900">{formatCurrency(v as number)}</span>
      ),
    },
    {
      key: "outstandingAmount",
      label: "Balance Due",
      render: (v) => (
        <span className={(v as number) > 0 ? "text-orange-600 font-semibold font-mono" : "text-emerald-600 font-mono"}>
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <Badge variant={statusVariants[v as string] ?? "secondary"} className="capitalize">
          {String(v).replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "_id",
      label: "Actions",
      className: "w-32 text-right",
      render: (_, row) => {
        const bill = row as unknown as Bill;
        const isUnpaid = bill.status === "unpaid" || bill.status === "overdue" || bill.status === "partially_paid";
        const isPaid = bill.status === "paid";
        return (
          <div className="flex items-center justify-end gap-1">
            {/* View invoice icon */}
            <Button variant="ghost" size="icon-sm" asChild title="View Invoice">
              <Link href={`/transactions/bills/${row._id}`}>
                <Eye className="h-3.5 w-3.5 text-slate-600" />
              </Link>
            </Button>

            {/* If Paid: Pencil icon to update services and generate NEXT month's bill */}
            {isPaid && (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Update Services & Generate Next Bill"
                className="text-primary hover:text-primary hover:bg-primary/10"
                onClick={() => openNextBillModal(bill)}
              >
                <Pencil className="h-3.5 w-3.5 text-primary" />
              </Button>
            )}

            {/* If Unpaid: Receive Payment & Edit current charges */}
            {isUnpaid && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Receive Payment"
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                  onClick={() => router.push(`/transactions/receipts?billId=${bill._id}`)}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Edit Bill Charges"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => openEditModal(bill)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  const tabs: TabKey[] = ["new", "paid", "partial", "all"];

  return (
    <div className="space-y-4">
      <PageHeader title="Bills" description="All generated invoices & payment tracking">
        <Button size="sm" asChild>
          <Link href="/transactions/generate-bill">
            <FilePlus className="h-3.5 w-3.5 mr-1" /> Generate Bill
          </Link>
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {tabs.map((k) => {
          const m = TAB_META[k];
          const Icon = m.icon;
          const isActive = tab === k && !statusFilter;
          const agg = aggregate[k];
          return (
            <button
              type="button"
              key={k}
              onClick={() => { setTab(k); setStatusFilter(""); }}
              className={`group relative text-left rounded-xl border bg-gradient-to-br ${m.accent} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isActive ? `ring-4 ${m.ring} shadow-md -translate-y-0.5` : "shadow-xs"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-md bg-white/80 border border-white shadow-2xs">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider opacity-90">{m.label}</p>
                    <p className="text-xl font-extrabold mt-0.5 tabular-nums">
                      {loading ? <span className="inline-block w-10 h-6 rounded bg-white/60 animate-pulse" /> : agg.count}
                    </p>
                  </div>
                </div>
                {k === "new" && !loading && agg.count > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-white/90 border border-orange-300/50 px-1.5 py-0.5 rounded-full shadow-2xs">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {agg.count}
                  </span>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-white/60 flex items-baseline justify-between">
                <p className="text-[10px] uppercase tracking-wider opacity-75 font-medium">Amount</p>
                <p className="text-sm font-mono font-bold tabular-nums">
                  {loading ? <span className="inline-block w-20 h-4 rounded bg-white/60 animate-pulse" /> : formatCurrency(agg.amount)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs
          value={statusFilter ? "_custom" : tab}
          onValueChange={(v) => {
            if (v === "_custom") return;
            setTab(v as TabKey);
            setStatusFilter("");
          }}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9 p-1 bg-slate-100/80 border border-slate-200 w-full sm:w-auto">
            {tabs.map((k) => (
              <TabsTrigger
                key={k}
                value={k}
                className="text-xs font-medium px-3 h-7 data-[state=active]:bg-white data-[state=active]:shadow-xs data-[state=active]:text-slate-900"
              >
                <span className="flex items-center gap-1.5">
                  {k === "new" && !loading && aggregate.new.count > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                  )}
                  {TAB_META[k].label}
                  {loading ? null : (
                    <span className="ml-0.5 text-[10px] text-slate-500 bg-slate-200/80 rounded-full px-1.5 py-0.5 tabular-nums">
                      {aggregate[k].count}
                    </span>
                  )}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status filter" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dual Search: Client Filter + Invoice Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="pl-8 h-9 text-xs bg-white"
            placeholder="Search by client name (e.g. Evermore, Rohan)..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            className="pl-8 h-9 text-xs bg-white"
            placeholder="Search by invoice number..."
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-xs bg-white">
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={data as unknown as Record<string, unknown>[]}
            loading={loading}
            totalCount={total}
            page={page}
            pageSize={20}
            onPageChange={setPage}
            searchValue=""
            onSearchChange={() => {}}
            searchPlaceholder=""
            emptyMessage={
              tab === "new"
                ? "No unpaid/new bills. All caught up!"
                : tab === "paid"
                  ? "No paid bills yet."
                  : tab === "partial"
                    ? "No partially paid bills."
                    : "No bills found."
            }
          />
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL 1: Next Month Bill Modal for PAID Bills (Services Update & Carry Reading) */}
      {/* ========================================================================= */}
      <Dialog open={nextBillModalOpen} onOpenChange={setNextBillModalOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Generate Next Month&apos;s Bill — {selectedPaidBill?.customerId?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Update services, carry forward meter readings, and create the next periodic bill.
                  <span className="font-semibold text-emerald-700 ml-1">
                    Past paid bill ({selectedPaidBill?.invoiceNumber}) remains untouched.
                  </span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {nextBillLoading ? (
              <div className="text-center py-12 text-xs text-slate-500 animate-pulse">
                Loading client profile &amp; reading history…
              </div>
            ) : (
              <>
                {/* Billing Period & Date Settings */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Billing Month</Label>
                    <select
                      value={nextBillMonth}
                      onChange={(e) => setNextBillMonth(e.target.value)}
                      className="mt-1 w-full h-8 border border-slate-200 rounded-md px-2 bg-white text-xs font-semibold"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Billing Year</Label>
                    <Input
                      type="number"
                      className="mt-1 h-8 text-xs font-mono font-semibold bg-white"
                      value={nextBillYear}
                      onChange={(e) => setNextBillYear(parseInt(e.target.value) || new Date().getFullYear())}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Invoice Date</Label>
                    <Input
                      type="date"
                      className="mt-1 h-8 text-xs bg-white"
                      value={nextBillInvoiceDate}
                      onChange={(e) => setNextBillInvoiceDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-700">Due Date</Label>
                    <Input
                      type="date"
                      className="mt-1 h-8 text-xs bg-white"
                      value={nextBillDueDate}
                      onChange={(e) => setNextBillDueDate(e.target.value)}
                    />
                  </div>
                </div>

                {/* Services Section Header */}
                <div className="flex items-center justify-between pt-1">
                  <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Services for Next Month ({nextBillMonth} {nextBillYear})
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddNextBillService}
                    className="h-7 text-xs bg-white border-primary/30 text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
                  </Button>
                </div>

                {/* Service Items List (Exact Add New Client UI) */}
                <div className="space-y-3">
                  {nextBillServices.map((service, index) => {
                    const isElectricity = (service.type || "").toLowerCase() === "electricity";
                    const isReadingMode = service.calculationMode !== "direct";
                    const { units: calculatedUnits } = getServiceUnitsAndAmount(service);

                    return (
                      <div
                        key={index}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isElectricity
                            ? "border-amber-300/80 bg-amber-50/20 shadow-xs"
                            : "border-slate-200 bg-white shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isElectricity
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="font-bold text-xs capitalize text-slate-900 flex items-center gap-1">
                              {isElectricity && <Zap className="h-3.5 w-3.5 text-amber-500" />}
                              {service.type || "Service"}
                            </span>
                          </div>
                          {nextBillServices.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleRemoveNextBillService(index)}
                              title="Remove service"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        {/* Service Type Dropdown */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2.5">
                          <div>
                            <Label className="text-xs text-slate-700 font-semibold">Service Type</Label>
                            <select
                              value={(service.type || "maintenance").toLowerCase()}
                              onChange={(e) => handleNextBillServiceChange(index, "type", e.target.value)}
                              className="mt-1 w-full h-8 border border-slate-200 rounded-md px-2.5 text-xs bg-white font-medium capitalize"
                            >
                              {serviceTypes.map((st) => (
                                <option key={st.value} value={st.value}>{st.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Standard Rate & Units for non-electricity */}
                          {!isElectricity && (
                            <>
                              <div>
                                <Label className="text-xs text-slate-700 font-semibold">Rate (₹)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="mt-1 h-8 text-xs bg-white"
                                  value={service.rate || ""}
                                  onChange={(e) =>
                                    handleNextBillServiceChange(index, "rate", parseFloat(e.target.value) || 0)
                                  }
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-700 font-semibold">Units / Qty</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="any"
                                  className="mt-1 h-8 text-xs bg-white"
                                  value={service.units || ""}
                                  onChange={(e) =>
                                    handleNextBillServiceChange(index, "units", parseFloat(e.target.value) || 0)
                                  }
                                  placeholder="1"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        {/* GST for non-electricity */}
                        {!isElectricity && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                              <Label className="text-[11px] font-semibold text-slate-700">Apply GST</Label>
                              <button
                                type="button"
                                onClick={() =>
                                  handleNextBillServiceChange(index, "isTaxable", !(service.isTaxable !== false))
                                }
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  service.isTaxable !== false ? "bg-emerald-600" : "bg-slate-300"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                    service.isTaxable !== false ? "translate-x-5" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-700 font-semibold">GST Slab (%)</Label>
                              <select
                                value={String(Number(service.gstRate) || 0)}
                                onChange={(e) =>
                                  handleNextBillServiceChange(index, "gstRate", parseFloat(e.target.value) || 0)
                                }
                                disabled={service.isTaxable === false}
                                className="mt-1 w-full h-8 border rounded-md px-2 text-xs bg-white font-semibold"
                              >
                                {GST_SLABS.map((slab) => (
                                  <option key={slab} value={slab}>
                                    {slab === 0 ? "0% (Exempt)" : `${slab}%`}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label className="text-xs text-slate-700 font-semibold">Line Total</Label>
                              <div className="mt-1 h-8 px-2 flex items-center rounded-md bg-primary/5 border border-primary/20 font-mono font-bold text-xs text-primary">
                                {formatCurrency(getServiceUnitsAndAmount(service).totalAmount)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Electricity Dedicated Dual Mode UI (Fixed Mode Locked Policy) */}
                        {isElectricity && (
                          <div className="space-y-3 pt-2 border-t border-amber-200">
                            {/* Mode Lock Badge */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100/80 border border-amber-300 text-xs font-bold text-amber-950 shadow-2xs">
                              <Lock className="h-3.5 w-3.5 text-amber-700" />
                              <span>Fixed Mode Policy (Locked for this client):</span>
                              <span className="font-extrabold underline ml-1">
                                {isReadingMode ? "Mode 1: Meter Reading Difference" : "Mode 2: Direct Consumed Units"}
                              </span>
                            </div>

                            {/* Mode 1: Meter Reading Difference */}
                            {isReadingMode ? (
                              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <span>Initial / Start Reading (kWh)</span>
                                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/80 border border-emerald-300 px-1.5 py-0.5 rounded">
                                        Auto-Fetched
                                      </span>
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold bg-emerald-50/50 border-emerald-300"
                                      value={service.initialReading ?? ""}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
                                          index,
                                          "initialReading",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 1200"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                      Previous bill ending reading (auto-populated)
                                    </span>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Current / Final Reading (kWh) *
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500"
                                      value={service.currentReading || ""}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
                                          index,
                                          "currentReading",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 1350"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                      Enter current month ending reading
                                    </span>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Rate per Unit (₹/kWh) *
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold bg-white"
                                      value={service.rate || ""}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
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

                                <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-amber-950 font-medium">
                                    <span>Client&apos;s Electricity Usage: </span>
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

                                {/* GST Section for Electricity Mode 1 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <Receipt className="h-3.5 w-3.5 text-sky-600" />
                                      <Label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                        Apply GST
                                      </Label>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleNextBillServiceChange(
                                          index,
                                          "isTaxable",
                                          !(service.isTaxable !== false)
                                        )
                                      }
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        service.isTaxable !== false ? "bg-emerald-600" : "bg-slate-300"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                          service.isTaxable !== false ? "translate-x-5" : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      GST Slab (%)
                                    </Label>
                                    <select
                                      value={String(Number(service.gstRate) || 0)}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
                                          index,
                                          "gstRate",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      disabled={service.isTaxable === false}
                                      className={`mt-1 w-full h-8 border rounded-md px-2 text-xs font-semibold ${
                                        service.isTaxable === false
                                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                          : "bg-white border-slate-200 text-slate-800"
                                      }`}
                                    >
                                      {GST_SLABS.map((slab) => (
                                        <option key={slab} value={slab}>
                                          {slab === 0 ? "0% (Exempt)" : `${slab}%`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <Calculator className="h-3 w-3 text-slate-400" />
                                      Line Total (incl. GST)
                                    </Label>
                                    <div className="mt-1 h-8 px-2 flex items-center rounded-md bg-primary/5 border border-primary/20">
                                      <span className="text-xs font-bold text-primary font-mono tabular-nums">
                                        {formatCurrency(getServiceUnitsAndAmount(service).totalAmount)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              /* Mode 2: Direct Consumed Units */
                              <div className="p-3.5 bg-white rounded-xl border border-amber-200/90 shadow-2xs space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Direct Consumed Units (kWh) *
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold"
                                      value={service.units || ""}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
                                          index,
                                          "units",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      placeholder="e.g. 20"
                                    />
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                      Direct meter units consumed
                                    </span>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      Rate per Unit (₹/kWh) *
                                    </Label>
                                    <Input
                                      type="number"
                                      step="any"
                                      className="mt-1 h-9 text-xs font-mono font-bold"
                                      value={service.rate || ""}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
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

                                <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-xs flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-amber-950 font-medium">
                                    Formula: {service.units || 0} kWh × ₹{service.rate || 0}
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

                                {/* GST Section for Electricity Mode 2 */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-amber-200/60">
                                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <Receipt className="h-3.5 w-3.5 text-sky-600" />
                                      <Label className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                        Apply GST
                                      </Label>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleNextBillServiceChange(
                                          index,
                                          "isTaxable",
                                          !(service.isTaxable !== false)
                                        )
                                      }
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                        service.isTaxable !== false ? "bg-emerald-600" : "bg-slate-300"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
                                          service.isTaxable !== false ? "translate-x-5" : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold">
                                      GST Slab (%)
                                    </Label>
                                    <select
                                      value={String(Number(service.gstRate) || 0)}
                                      onChange={(e) =>
                                        handleNextBillServiceChange(
                                          index,
                                          "gstRate",
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      disabled={service.isTaxable === false}
                                      className={`mt-1 w-full h-8 border rounded-md px-2 text-xs font-semibold ${
                                        service.isTaxable === false
                                          ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                          : "bg-white border-slate-200 text-slate-800"
                                      }`}
                                    >
                                      {GST_SLABS.map((slab) => (
                                        <option key={slab} value={slab}>
                                          {slab === 0 ? "0% (Exempt)" : `${slab}%`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                      <Calculator className="h-3 w-3 text-slate-400" />
                                      Line Total (incl. GST)
                                    </Label>
                                    <div className="mt-1 h-8 px-2 flex items-center rounded-md bg-primary/5 border border-primary/20">
                                      <span className="text-xs font-bold text-primary font-mono tabular-nums">
                                        {formatCurrency(getServiceUnitsAndAmount(service).totalAmount)}
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
                </div>

                {/* Live Summary Box for New Bill */}
                {(() => {
                  const totals = calculateTotalServiceAmount(nextBillServices);
                  return (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden text-xs">
                      <div className="p-3 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-slate-600 font-medium">Subtotal ({nextBillServices.length} services):</span>
                        <span className="font-mono font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</span>
                      </div>
                      {totals.totalGst > 0 && (
                        <div className="p-3 border-b border-slate-200 flex justify-between items-center text-emerald-700">
                          <span>Total GST:</span>
                          <span className="font-mono font-semibold">+{formatCurrency(totals.totalGst)}</span>
                        </div>
                      )}
                      <div className="p-3.5 bg-white flex justify-between items-center">
                        <span className="font-bold text-slate-900 text-sm">Grand Total (Next Month Bill):</span>
                        <span className="font-mono font-black text-primary text-base">
                          {formatCurrency(totals.grandTotal)}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNextBillModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={nextBillSaving}
              onClick={handleSaveNextMonthBill}
              className="gap-1.5 shadow-xs"
            >
              <Sparkles className="h-4 w-4" /> Generate &amp; Save Next Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* MODAL 2: Edit Unpaid Bill Dialog (For modifying dynamic charges before payment) */}
      {/* ========================================================================= */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span>Edit Bill: {editingBill?.invoiceNumber}</span>
              <span className="text-xs font-normal text-slate-500">
                {editingBill?.customerId?.name} ({editingBill?.billingMonth} {editingBill?.billingYear})
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modify service charges, rates, or add dynamic services (like water charge) for this unpaid bill.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Service Line Items
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddItem}
                  className="h-7 text-xs bg-white"
                >
                  <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Add Charge
                </Button>
              </div>

              <div className="space-y-2.5">
                {editItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        className="h-8 text-xs font-semibold bg-white flex-1"
                        placeholder="Service / Charge Name"
                        value={item.serviceName}
                        onChange={(e) => handleItemChange(idx, "serviceName", e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-rose-500 hover:bg-rose-50"
                        onClick={() => handleRemoveItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-[10px] text-slate-500">Qty / Units</Label>
                        <Input
                          type="number"
                          step="any"
                          className="h-8 text-xs bg-white mt-0.5"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, "quantity", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Unit Name</Label>
                        <Input
                          className="h-8 text-xs bg-white mt-0.5"
                          placeholder="e.g. unit/kWh"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Rate (₹)</Label>
                        <Input
                          type="number"
                          step="any"
                          className="h-8 text-xs bg-white mt-0.5"
                          value={item.rate}
                          onChange={(e) =>
                            handleItemChange(idx, "rate", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Total (₹)</Label>
                        <div className="h-8 flex items-center px-2 font-mono font-bold text-slate-900 bg-white border rounded mt-0.5">
                          {formatCurrency(item.totalAmount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Other Charges & Recalculation */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Subtotal:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatCurrency(editComputed.subtotal)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">GST:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {formatCurrency(editComputed.totalGst)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-900 text-sm">Grand Total:</span>
                <span className="font-mono font-black text-primary text-base">
                  {formatCurrency(editComputed.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={editSaving}
              onClick={handleSaveEdit}
              className="shadow-xs"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
