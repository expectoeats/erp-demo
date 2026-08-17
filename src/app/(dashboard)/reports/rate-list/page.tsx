"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface RateListEntry {
  _id: string;
  locationId: { name: string };
  subLocationId?: { name: string };
  serviceId: { name: string };
  financialYearId: { name: string };
  rate: number;
  unit: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export default function RateListReportPage() {
  const [data, setData] = useState<RateListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/rate-lists?search=${encodeURIComponent(debouncedSearch)}`
      );
      const d = await r.json();
      setData(d.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "locationId",
      label: "Location",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "subLocationId",
      label: "Sub Location",
      render: (v) => (v as { name: string })?.name ?? "-",
    },
    {
      key: "serviceId",
      label: "Service",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "financialYearId",
      label: "Financial Year",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "rate",
      label: "Rate",
      render: (v, row) =>
        `${formatCurrency(v as number)}/${String((row as RateListEntry).unit ?? "unit")}`,
    },
    { key: "unit", label: "Unit" },
    {
      key: "effectiveFrom",
      label: "Effective From",
      render: (v) => formatDate(v as string),
    },
    {
      key: "effectiveTo",
      label: "Effective To",
      render: (v) => (v ? formatDate(v as string) : "-"),
    },
    {
      key: "isActive",
      label: "Active",
      render: (v) => (
        <Badge variant={v ? "success" : "muted"}>
          {v ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rate List Report"
        description="Effective rates and charges"
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
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search location, service..."
        emptyMessage="No rate lists found."
      />
    </div>
  );
}
