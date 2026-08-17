"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/use-debounce";

interface Receipt {
  _id: string;
  receiptNumber: string;
  customerId: { name: string };
  unitId: { unitCode: string };
  billId: { invoiceNumber: string };
  amount: number;
  receiptDate: string;
  paymentMode: string;
}

export default function ReceiptsPage() {
  const [data, setData] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/receipts?page=${page}&search=${encodeURIComponent(debouncedSearch)}`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    { key: "receiptNumber", label: "Receipt No" },
    { key: "customerId", label: "Customer", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "unitId", label: "Unit", render: (v) => (v as { unitCode: string })?.unitCode ?? "" },
    { key: "billId", label: "Invoice", render: (v) => (v as { invoiceNumber: string })?.invoiceNumber ?? "" },
    { key: "amount", label: "Amount", render: (v) => <span className="text-emerald-600 font-medium">{formatCurrency(v as number)}</span> },
    { key: "receiptDate", label: "Date", render: (v) => formatDate(v as string) },
    { key: "paymentMode", label: "Mode", render: (v) => <Badge variant="secondary">{String(v).replace("_", " ")}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Receipts" description="All payment receipts" />
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
        searchPlaceholder="Search receipt number..."
        emptyMessage="No receipts yet."
      />
    </div>
  );
}
