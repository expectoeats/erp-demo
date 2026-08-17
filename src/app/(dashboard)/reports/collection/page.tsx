"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CollectionEntry {
  _id: string;
  paymentId: string;
  customerId: { name: string };
  unitId: { unitCode: string };
  billId: { invoiceNumber: string };
  amount: number;
  paymentDate: string;
  paymentMode: string;
  referenceNumber?: string;
}

export default function CollectionPage() {
  const [data, setData] = useState<CollectionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/payments?page=${page}&limit=25`);
    const d = await r.json();
    setData(d.data ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    { key: "paymentId", label: "Payment ID" },
    { key: "customerId", label: "Customer", render: (v) => (v as { name: string })?.name ?? "" },
    { key: "unitId", label: "Unit", render: (v) => (v as { unitCode: string })?.unitCode ?? "" },
    { key: "billId", label: "Invoice", render: (v) => (v as { invoiceNumber: string })?.invoiceNumber ?? "" },
    { key: "amount", label: "Amount", render: (v) => <span className="text-emerald-600 font-medium">{formatCurrency(v as number)}</span> },
    { key: "paymentDate", label: "Date", render: (v) => formatDate(v as string) },
    { key: "paymentMode", label: "Mode", render: (v) => <Badge variant="secondary">{String(v).replace("_", " ")}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Collection Report" description="All payment collections" />
      <DataTable columns={columns} data={data as unknown as Record<string, unknown>[]} loading={loading} totalCount={total} page={page} pageSize={25} onPageChange={setPage} emptyMessage="No collections yet." />
    </div>
  );
}
