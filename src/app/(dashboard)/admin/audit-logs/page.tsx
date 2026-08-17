"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSearch, User, Shield, Edit, Trash2, Plus, Settings } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface AuditLogEntry {
  _id: string;
  userId?: { name?: string; email?: string };
  action: string;
  entity: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const actionVariants: Record<string, "default" | "success" | "warning" | "destructive" | "info" | "secondary"> = {
  create: "success",
  update: "default",
  delete: "destructive",
  login: "info",
  logout: "secondary",
  export: "warning",
  change_password: "warning",
  approve: "success",
};

const actionIcons: Record<string, React.ReactNode> = {
  create: <Plus className="h-3 w-3" />,
  update: <Edit className="h-3 w-3" />,
  delete: <Trash2 className="h-3 w-3" />,
  login: <Shield className="h-3 w-3" />,
  logout: <Shield className="h-3 w-3" />,
  export: <FileSearch className="h-3 w-3" />,
  change_password: <Settings className="h-3 w-3" />,
};

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/admin/audit-logs?page=${page}&limit=25&search=${encodeURIComponent(debouncedSearch)}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (entityFilter) url += `&entity=${entityFilter}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("API not available");
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, actionFilter, entityFilter]);

  useEffect(() => { load(); }, [load]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "createdAt",
      label: "Timestamp",
      className: "w-40",
      render: (v) => (
        <div className="text-xs">
          <div className="font-medium text-slate-700">{formatDate(v as string)}</div>
          <div className="text-slate-400">{typeof v === "string" ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}</div>
        </div>
      ),
    },
    {
      key: "userId",
      label: "User",
      render: (v) => {
        const user = v as { name?: string; email?: string } | undefined;
        return (
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-3 w-3" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-700">{user?.name ?? "System"}</div>
              <div className="text-[11px] text-slate-400">{user?.email ?? "-"}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "action",
      label: "Action",
      className: "w-32",
      render: (v) => {
        const a = String(v ?? "");
        const variant = actionVariants[a] ?? "secondary";
        return (
          <Badge variant={variant} className="inline-flex items-center gap-1">
            {actionIcons[a]}
            <span className="capitalize">{a.replace("_", " ")}</span>
          </Badge>
        );
      },
    },
    {
      key: "entity",
      label: "Entity",
      className: "w-32",
      render: (v) => <Badge variant="outline" className="font-normal">{String(v ?? "-")}</Badge>,
    },
    {
      key: "entityId",
      label: "Entity ID",
      className: "w-36",
      render: (v) => v ? <span className="font-mono text-[11px] text-slate-500">{String(v)}</span> : <span className="text-slate-300">-</span>,
    },
    {
      key: "ipAddress",
      label: "IP Address",
      className: "w-28",
      render: (v) => v ? <span className="font-mono text-[11px] text-slate-500">{String(v)}</span> : <span className="text-slate-300">-</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Complete trail of all system activities and changes"
      >
        <Button size="sm" variant="outline">
          <Download className="h-3.5 w-3.5 mr-1" /> Export Logs
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
            <SelectItem value="export">Export</SelectItem>
          </SelectContent>
        </Select>

        <Select value={entityFilter} onValueChange={(v) => { setEntityFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 h-8 text-xs">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Entities</SelectItem>
            <SelectItem value="Customer">Customer</SelectItem>
            <SelectItem value="Location">Location</SelectItem>
            <SelectItem value="Unit">Unit</SelectItem>
            <SelectItem value="Meter">Meter</SelectItem>
            <SelectItem value="Bill">Bill</SelectItem>
            <SelectItem value="Payment">Payment</SelectItem>
            <SelectItem value="RateList">Rate List</SelectItem>
            <SelectItem value="User">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={total}
        page={page}
        pageSize={25}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search user, entity..."
        emptyMessage={
          <div className="flex flex-col items-center gap-2 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <FileSearch className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">No audit logs found</p>
            <p className="text-xs text-slate-400">System activity will appear here as users perform actions.</p>
          </div>
        }
      />
    </div>
  );
}
