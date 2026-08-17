"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface BillingEntry {
  _id: string;
  invoiceNumber: string;
  customerId: { name: string };
  unitId: { unitCode: string };
  billingMonth: string;
  billingYear: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: string;
  invoiceDate: string;
}

const statusVariants: Record<string, string> = {
  unpaid: "warning",
  partially_paid: "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "muted",
};

export default function BillingReportPage() {
  const [data, setData] = useState<BillingEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/bills?page=${page}&search=${encodeURIComponent(debouncedSearch)}&limit=25`
      );
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    { key: "invoiceNumber", label: "Invoice No" },
    {
      key: "customerId",
      label: "Customer",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "unitId",
      label: "Unit",
      render: (v) => (v as { unitCode: string })?.unitCode ?? "",
    },
    {
      key: "billingMonth",
      label: "Billing Period",
      render: (v, row) => `${String(v ?? "")} ${String((row as BillingEntry).billingYear ?? "")}`,
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      render: (v) => formatCurrency(v as number),
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (v) => formatCurrency(v as number),
    },
    {
      key: "outstandingAmount",
      label: "Outstanding",
      render: (v) => (
        <span className={(v as number) > 0 ? "text-orange-600" : ""}>
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <Badge variant={(statusVariants[String(v)] as never) ?? "default"}>
          {String(v).replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "invoiceDate",
      label: "Invoice Date",
      render: (v) => formatDate(v as string),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Billing Report"
        description="Overview of all bills generated"
      >
        <Button size="sm" variant="outline">
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
      </PageHeader>
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={total}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search invoice number, customer..."
        emptyMessage="No bills found."
      />
    </div>
  );
}
