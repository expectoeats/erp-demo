"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, AlertCircle, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface Bill {
  _id: string;
  invoiceNumber: string;
  customerId: { name: string; customerId: string; mobile?: string };
  unitId: { unitCode: string };
  locationId: { name: string };
  invoiceDate: string;
  dueDate: string;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  billingMonth: string;
  billingYear: number;
}

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

const statusVariants: Record<string, "default" | "success" | "warning" | "destructive" | "muted" | "info"> = {
  unpaid: "warning",
  partially_paid: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "muted",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

export default function BillListPage() {
  const [data, setData] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter] = useState("paid");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [fyFilter, setFyFilter] = useState("");
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [stats, setStats] = useState<BillStats | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const loadStats = useCallback(async () => {
    let url = "/api/bills/stats";
    const params = new URLSearchParams();
    if (monthFilter) params.set("billingMonth", monthFilter);
    if (yearFilter) params.set("billingYear", yearFilter);
    if (fyFilter) params.set("financialYearId", fyFilter);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    const r = await fetch(url);
    const d = await r.json();
    setStats(d.data);
  }, [monthFilter, yearFilter, fyFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      search: debouncedSearch,
    });
    if (statusFilter) params.set("status", statusFilter);
    if (monthFilter) params.set("billingMonth", monthFilter);
    if (yearFilter) params.set("billingYear", yearFilter);
    if (fyFilter) params.set("financialYearId", fyFilter);
    const r = await fetch(`/api/bills?${params.toString()}`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [debouncedSearch, page, statusFilter, monthFilter, yearFilter, fyFilter]);

  useEffect(() => {
    fetch("/api/financial-years")
      .then((r) => r.json())
      .then((d) => setFinancialYears(d.data ?? []));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "invoiceNumber", label: "Invoice No",
      render: (v) => <span className="font-mono font-semibold text-xs">{String(v)}</span>,
    },
    {
      key: "customerId", label: "Customer",
      render: (v) => {
        const c = v as { name: string; customerId: string; mobile?: string };
        return (
          <div>
            <div className="font-medium text-xs">{c?.name ?? ""}</div>
            <div className="text-[11px] text-muted-foreground">{c?.mobile ?? c?.customerId ?? ""}</div>
          </div>
        );
      },
    },
    {
      key: "unitId", label: "Unit",
      render: (v) => (v as { unitCode: string })?.unitCode ?? "",
    },
    {
      key: "billingMonth", label: "Period",
      render: (v, row) => (
        <div className="text-xs">
          <div className="font-medium">{String(v)}</div>
          <div className="text-muted-foreground">{(row as unknown as Bill).billingYear}</div>
        </div>
      ),
    },
    {
      key: "grandTotal", label: "Total",
      render: (v) => <span className="font-semibold text-xs">{formatCurrency(v as number)}</span>,
    },
    {
      key: "paidAmount", label: "Paid",
      render: (v) => <span className="text-xs text-emerald-600">{formatCurrency(v as number)}</span>,
    },
    {
      key: "outstandingAmount", label: "Outstanding",
      render: (v) => (
        <span className={(v as number) > 0 ? "text-orange-600 font-semibold text-xs" : "text-xs text-muted-foreground"}>
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "status", label: "Status",
      render: (v) => (
        <Badge variant={statusVariants[v as string] ?? "secondary"} className="text-[10px]">
          {String(v).replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "dueDate", label: "Due Date",
      render: (v, row) => {
        const due = new Date(v as string);
        const isOverdue = due < new Date() && (row as unknown as Bill).status !== "paid" && (row as unknown as Bill).status !== "cancelled";
        return (
          <div className="flex items-center gap-1">
            {isOverdue && <AlertCircle className="h-3 w-3 text-red-500" />}
            <span className={isOverdue ? "text-red-600 font-semibold text-xs" : "text-xs"}>
              {formatDate(v as string)}
            </span>
          </div>
        );
      },
    },
    {
      key: "_id", label: "",
      render: (_, row) => (
        <Link href={`/transactions/bills/${row._id}`} className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted transition-colors">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Bill List" description="Complete bill management and overview">
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Total Bills</span>
            <div className="text-2xl font-bold text-foreground mt-1">{stats?.totalBills ?? 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Paid</span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats?.paidCount ?? 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Unpaid</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{(stats?.unpaidCount ?? 0) + (stats?.partiallyPaidCount ?? 0)}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Overdue</span>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats?.overdueCount ?? 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Outstanding</span>
            <div className="text-xl font-bold text-red-600 mt-1">{formatCurrency(stats?.totalOutstanding ?? 0)}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All months" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {financialYears.length > 0 && (
          <Select value={fyFilter} onValueChange={setFyFilter}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="All financial years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All FY</SelectItem>
              {financialYears.map((fy) => (
                <SelectItem key={fy._id} value={fy._id}>{fy.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

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
        searchPlaceholder="Search invoice number..."
        emptyMessage="No bills found."
      />
    </div>
  );
}
