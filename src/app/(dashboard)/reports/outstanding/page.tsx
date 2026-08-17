"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface OutstandingBill {
  _id: string;
  invoiceNumber: string;
  customerId: { name: string; customerId: string };
  unitId: { unitCode: string };
  invoiceDate: string;
  dueDate: string;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  billingMonth: string;
  billingYear: number;
}

export default function OutstandingPage() {
  const [data, setData] = useState<OutstandingBill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/bills?status=unpaid&page=${page}&search=${encodeURIComponent(debouncedSearch)}`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    { key: "invoiceNumber", label: "Invoice No" },
    { key: "customerId", label: "Customer", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "unitId", label: "Unit", render: (v) => (v as { unitCode: string })?.unitCode ?? "" },
    { key: "invoiceDate", label: "Bill Date", render: (v) => formatDate(v as string) },
    { key: "dueDate", label: "Due Date", render: (v) => formatDate(v as string) },
    { key: "grandTotal", label: "Total", render: (v) => formatCurrency(v as number) },
    { key: "paidAmount", label: "Paid", render: (v) => formatCurrency(v as number) },
    { key: "outstandingAmount", label: "Outstanding", render: (v) => <span className="text-orange-600 font-medium">{formatCurrency(v as number)}</span> },
    { key: "status", label: "Status", render: (v) => <Badge variant={v === "overdue" ? "destructive" : "warning"}>{String(v).replace("_", " ")}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Outstanding Report" description="All unpaid and partially paid bills" />
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
        searchPlaceholder="Search invoice..."
        emptyMessage="No outstanding bills."
      />
    </div>
  );
}
