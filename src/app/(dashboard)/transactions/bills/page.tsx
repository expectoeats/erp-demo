"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, FilePlus } from "lucide-react";
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

export default function BillsPage() {
  const [data, setData] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    let url = `/api/bills?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`;
    if (statusFilter) url += `&status=${statusFilter}`;
    const r = await fetch(url);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [debouncedSearch, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

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
      render: (v) => <Badge variant={statusVariants[v as string] ?? "secondary"}>{String(v).replace("_", " ")}</Badge>
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

  return (
    <div>
      <PageHeader title="Bills" description="All generated invoices">
        <Button size="sm" asChild>
          <Link href="/transactions/generate-bill"><FilePlus className="h-3.5 w-3.5 mr-1" /> Generate Bill</Link>
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partially_paid">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
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
