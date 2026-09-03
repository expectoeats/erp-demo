"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertCircle, CircleDollarSign, Clock, Eye, FileCheck2, FilePlus, Receipt } from "lucide-react";
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

export default function BillsPage() {
  const [data, setData] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tab, setTab] = useState<TabKey>("new");
  const debouncedSearch = useDebounce(search, 400);

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
      let url = `/api/bills?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`;
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
  }, [debouncedSearch, page, effectiveStatus]);

  useEffect(() => {
    setPage(1);
  }, [tab, statusFilter, debouncedSearch]);

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    { key: "invoiceNumber", label: "Invoice No" },
    { key: "customerId", label: "Customer", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "unitId", label: "Unit", render: (v) => (v as { unitCode: string })?.unitCode ?? "" },
    { key: "invoiceDate", label: "Date", render: (v) => formatDate(v as string) },
    { key: "billingMonth", label: "Month", render: (v, row) => `${v} ${(row as unknown as Bill).billingYear}` },
    { key: "grandTotal", label: "Total", render: (v) => formatCurrency(v as number) },
    { key: "paidAmount", label: "Paid", render: (v) => formatCurrency(v as number) },
    { key: "outstandingAmount", label: "Outstanding", render: (v) => <span className={(v as number) > 0 ? "text-orange-600" : ""}>{formatCurrency(v as number)}</span> },
    {
      key: "status", label: "Status",
      render: (v) => <Badge variant={statusVariants[v as string] ?? "secondary"}>{String(v).replace("_", " ")}</Badge>,
    },
    {
      key: "_id", label: "",
      render: (_, row) => (
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/transactions/bills/${row._id}`}><Eye className="h-3.5 w-3.5" /></Link>
        </Button>
      ),
    },
  ];

  const tabs: TabKey[] = ["new", "paid", "partial", "all"];

  return (
    <div className="space-y-4">
      <PageHeader title="Bills" description="All generated invoices">
        <Button size="sm" asChild>
          <Link href="/transactions/generate-bill"><FilePlus className="h-3.5 w-3.5 mr-1" /> Generate Bill</Link>
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
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Status filter" /></SelectTrigger>
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
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search invoice number..."
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
    </div>
  );
}
