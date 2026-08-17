"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Download } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface TransferEntry {
  _id: string;
  transferId: string;
  unitId: { unitCode: string };
  oldOwnerId: { name: string };
  newOwnerId: { name: string };
  transferDate: string;
  reason: string;
  status: string;
  notes?: string;
}

export default function TransfersReportPage() {
  const [data, setData] = useState<TransferEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/ownership-transfers?search=${encodeURIComponent(debouncedSearch)}`
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
    { key: "transferId", label: "Transfer ID" },
    {
      key: "unitId",
      label: "Unit",
      render: (v) => (v as { unitCode: string })?.unitCode ?? "",
    },
    {
      key: "oldOwnerId",
      label: "Old Owner",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "newOwnerId",
      label: "New Owner",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "transferDate",
      label: "Transfer Date",
      render: (v) => formatDate(v as string),
    },
    {
      key: "reason",
      label: "Reason",
      render: (v) => <Badge variant="secondary">{String(v ?? "-")}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (v) => {
        const s = String(v ?? "");
        const variant =
          s === "approved" ? "success" : s === "pending" ? "warning" : "default";
        return <Badge variant={variant as never}>{s.replace("_", " ")}</Badge>;
      },
    },
    {
      key: "notes",
      label: "Notes",
      render: (v) => String(v ?? "-"),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Transfers Report"
        description="All ownership transfer history"
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
        searchPlaceholder="Search unit, owners..."
        emptyMessage="No transfer records found."
      />
    </div>
  );
}
