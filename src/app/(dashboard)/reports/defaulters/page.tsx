"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download } from "lucide-react";

interface DefaulterEntry {
  _id: string;
  customerId: { name: string; customerId: string; phone?: string };
  unitId: { unitCode: string };
  invoiceNumber: string;
  dueDate: string;
  grandTotal: number;
  outstandingAmount: number;
}

export default function DefaultersReportPage() {
  const [data, setData] = useState<DefaulterEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bills?status=overdue");
      const d = await r.json();
      setData(d.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "customerId",
      label: "Customer Name",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "customerId",
      label: "Customer ID",
      render: (v) => (v as { customerId: string })?.customerId ?? "",
    },
    {
      key: "unitId",
      label: "Unit",
      render: (v) => (v as { unitCode: string })?.unitCode ?? "",
    },
    { key: "invoiceNumber", label: "Invoice No" },
    {
      key: "dueDate",
      label: "Due Date",
      render: (v) => formatDate(v as string),
    },
    {
      key: "grandTotal",
      label: "Bill Amount",
      render: (v) => formatCurrency(v as number),
    },
    {
      key: "outstandingAmount",
      label: "Outstanding",
      render: (v) => (
        <span className="text-destructive font-medium">
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "_id",
      label: "Days Overdue",
      render: () => <Badge variant="destructive">30 days</Badge>,
    },
    {
      key: "customerId",
      label: "Contact",
      render: (v) => (v as { phone?: string })?.phone ?? "-",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Defaulters Report"
        description="Customers with overdue bills"
      >
        <Button size="sm" variant="outline">
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
      </PageHeader>
      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={data.length}
        emptyMessage="No defaulters found. All payments are up to date!"
      />
    </div>
  );
}
