"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface Bill {
  _id: string;
  invoiceNumber: string;
  customerId: { name: string; customerId: string };
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

export default function NewBillsPage() {
  const [data, setData] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [stats, setStats] = useState<BillStats | null>(null);
  const debouncedSearch = useDebounce(search, 400);

  const loadStats = useCallback(async () => {
    let url = "/api/bills/stats?status=unpaid,partially_paid";
    if (monthFilter) url += `&billingMonth=${monthFilter}`;
    if (yearFilter) url += `&billingYear=${yearFilter}`;
    const r = await fetch(url);
    const d = await r.json();
    setStats(d.data);
  }, [monthFilter, yearFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    let url = `/api/bills?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}&status=unpaid,partially_paid`;
    if (monthFilter) url += `&billingMonth=${monthFilter}`;
    if (yearFilter) url += `&billingYear=${yearFilter}`;
    const r = await fetch(url);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [debouncedSearch, page, monthFilter, yearFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const filteredData = statusFilter === "all"
    ? data
    : data.filter((b) => b.status === statusFilter);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "invoiceNumber", label: "Invoice No",
      render: (v) => <span className="font-mono font-semibold text-xs">{String(v)}</span>,
    },
    {
      key: "customerId", label: "Customer",
      render: (v) => {
        const c = v as { name: string; customerId: string };
        return (
          <div>
            <div className="font-medium text-xs">{c?.name ?? ""}</div>
            <div className="text-[11px] text-muted-foreground">{c?.customerId ?? ""}</div>
          </div>
        );
      },
    },
    {
      key: "unitId", label: "Unit",
      render: (v) => (v as { unitCode: string })?.unitCode ?? "",
    },
    {
      key: "billingMonth", label: "Billing Period",
      render: (v, row) => `${v} ${(row as unknown as Bill).billingYear}`,
    },
    {
      key: "grandTotal", label: "Total",
      render: (v) => <span className="font-semibold">{formatCurrency(v as number)}</span>,
    },
    {
      key: "outstandingAmount", label: "Outstanding",
      render: (v) => (
        <span className={(v as number) > 0 ? "text-orange-600 font-semibold" : "text-emerald-600"}>
          {formatCurrency(v as number)}
        </span>
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
      key: "status", label: "Status",
      render: (v) => (
        <Badge variant={statusVariants[v as string] ?? "secondary"}>
          {String(v).replace("_", " ")}
        </Badge>
      ),
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
      <PageHeader title="New Bills" description="Track newly generated unpaid and partially paid bills">
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Total New</span>
            <div className="text-2xl font-bold text-foreground mt-1">{stats?.totalBills ?? 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Unpaid</span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats?.unpaidCount ?? 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Partially Paid</span>
            <div className="text-2xl font-bold text-orange-600 mt-1">{stats?.partiallyPaidCount ?? 0}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Total Amount</span>
            <div className="text-xl font-bold text-foreground mt-1">{formatCurrency(stats?.totalAmount ?? 0)}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider">Outstanding</span>
            <div className="text-xl font-bold text-red-600 mt-1">{formatCurrency(stats?.totalOutstanding ?? 0)}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-red-50 text-red-600">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pending</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
          </SelectContent>
        </Select>
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
      </div>

      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoice number..."
        emptyMessage="No new bills found."
      />
    </div>
  );
}
