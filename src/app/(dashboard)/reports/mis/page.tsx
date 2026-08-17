"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { FileText } from "lucide-react";

interface MonthlySummary {
  month: string;
  billsGenerated: number;
  billedAmount: number;
  collectedAmount: number;
  outstanding: number;
  collectionRate: number;
}

const mockSummary: MonthlySummary[] = [
  { month: "Apr 2025", billsGenerated: 45, billedAmount: 1250000, collectedAmount: 1100000, outstanding: 150000, collectionRate: 88 },
  { month: "May 2025", billsGenerated: 48, billedAmount: 1320000, collectedAmount: 1188000, outstanding: 132000, collectionRate: 90 },
  { month: "Jun 2025", billsGenerated: 50, billedAmount: 1400000, collectedAmount: 1260000, outstanding: 140000, collectionRate: 90 },
  { month: "Jul 2025", billsGenerated: 52, billedAmount: 1450000, collectedAmount: 1305000, outstanding: 145000, collectionRate: 90 },
  { month: "Aug 2025", billsGenerated: 55, billedAmount: 1520000, collectedAmount: 1292000, outstanding: 228000, collectionRate: 85 },
];

export default function MISReportPage() {
  const [stats, setStats] = useState({
    totalBills: 0,
    collected: 0,
    outstanding: 0,
    totalUnits: 0,
    activeCustomers: 0,
    pendingReadings: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billsRes, unitsRes, customersRes] = await Promise.allSettled([
        fetch("/api/bills?limit=1"),
        fetch("/api/units"),
        fetch("/api/customers"),
      ]);

      let totalBills = 0;
      let collected = 0;
      let outstanding = 0;
      let totalUnits = 0;
      let activeCustomers = 0;

      if (billsRes.status === "fulfilled") {
        try {
          const d = await billsRes.value.json();
          totalBills = d.total ?? 0;
        } catch {}
      }
      if (unitsRes.status === "fulfilled") {
        try {
          const d = await unitsRes.value.json();
          totalUnits = (d.data ?? []).length;
        } catch {}
      }
      if (customersRes.status === "fulfilled") {
        try {
          const d = await customersRes.value.json();
          activeCustomers = (d.data ?? []).filter(
            (c: { isActive?: boolean }) => c.isActive !== false
          ).length;
        } catch {}
      }

      setStats({
        totalBills,
        collected,
        outstanding,
        totalUnits,
        activeCustomers,
        pendingReadings: 0,
      });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statBoxes = [
    {
      label: "Total Bills",
      value: String(stats.totalBills),
      className: "",
    },
    {
      label: "Collected",
      value: formatCurrency(stats.collected),
      className: "",
    },
    {
      label: "Outstanding",
      value: formatCurrency(stats.outstanding),
      className: "text-orange-600",
    },
    {
      label: "Total Units",
      value: String(stats.totalUnits),
      className: "",
    },
    {
      label: "Active Customers",
      value: String(stats.activeCustomers),
      className: "",
    },
    {
      label: "Pending Readings",
      value: String(stats.pendingReadings),
      className: "",
    },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    { key: "month", label: "Month" },
    { key: "billsGenerated", label: "Bills Generated" },
    {
      key: "billedAmount",
      label: "Billed Amount",
      render: (v) => formatCurrency(v as number),
    },
    {
      key: "collectedAmount",
      label: "Collected Amount",
      render: (v) => (
        <span className="text-emerald-600 font-medium">
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "outstanding",
      label: "Outstanding",
      render: (v) => (
        <span className="text-orange-600 font-medium">
          {formatCurrency(v as number)}
        </span>
      ),
    },
    {
      key: "collectionRate",
      label: "Collection Rate",
      render: (v) => `${String(v)}%`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="MIS Dashboard / Report"
        description="Executive summary across all modules"
      >
        <Button size="sm" variant="outline">
          <FileText className="h-3.5 w-3.5 mr-1" /> Export MIS
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {statBoxes.map((s, i) => (
          <Card
            key={i}
            className="bg-slate-50 border border-slate-100 rounded-lg p-4"
          >
            <h4 className={`text-lg font-semibold ${s.className}`}>
              {loading ? (
                <div className="h-5 bg-muted animate-pulse rounded w-16" />
              ) : (
                s.value
              )}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3 text-foreground">
          Monthly Summary
        </h3>
        <DataTable
          columns={columns}
          data={mockSummary as unknown as Record<string, unknown>[]}
          loading={false}
          totalCount={mockSummary.length}
          emptyMessage="No monthly summary data."
        />
      </div>
    </div>
  );
}
