"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Download } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface UnitEntry {
  _id: string;
  unitCode: string;
  unitType: string;
  location: { name: string };
  subLocation?: { name: string };
  areaSize: number;
  monthlyRent: number;
  isActive: boolean;
}

export default function UnitsReportPage() {
  const [data, setData] = useState<UnitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/units?search=${encodeURIComponent(debouncedSearch)}`
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
    { key: "unitCode", label: "Unit Code" },
    { key: "unitType", label: "Type" },
    {
      key: "location",
      label: "Location",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "subLocation",
      label: "Sub Location",
      render: (v) => (v as { name: string })?.name ?? "-",
    },
    {
      key: "areaSize",
      label: "Area (sq ft)",
      render: (v) => `${String(v ?? 0)} sq ft`,
    },
    {
      key: "monthlyRent",
      label: "Monthly Rent",
      render: (v) => formatCurrency(v as number),
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
    {
      key: "_id",
      label: "Occupancy",
      render: (v) => {
        const id = String(v ?? "");
        const lastDigit = parseInt(id.slice(-1), 10);
        const isOccupied = !isNaN(lastDigit) && lastDigit % 2 === 1;
        return (
          <Badge variant={isOccupied ? "default" : "success"}>
            {isOccupied ? "Occupied" : "Vacant"}
          </Badge>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Units Report"
        description="All units and their status"
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
        searchPlaceholder="Search unit code..."
        emptyMessage="No units found."
      />
    </div>
  );
}
