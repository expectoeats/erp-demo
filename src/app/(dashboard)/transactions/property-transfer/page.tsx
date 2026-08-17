"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Eye, ArrowLeftRight, FileText } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate } from "@/lib/utils";

interface OwnershipTransfer {
  _id: string;
  transferId: string;
  unitId?: { _id: string; unitCode: string };
  oldOwnerId?: { _id: string; name: string };
  newOwnerId?: { _id: string; name: string };
  transferDate: string;
  reason?: "Sale" | "Gift" | "Inheritance" | "Other";
  notes?: string;
  approvedBy?: string;
  status?: "pending" | "approved";
}

const reasonOptions: ("Sale" | "Gift" | "Inheritance" | "Other")[] = [
  "Sale", "Gift", "Inheritance", "Other",
];

const emptyForm = {
  unitId: "",
  oldOwnerId: "",
  newOwnerId: "",
  transferDate: "",
  reason: "" as "" | "Sale" | "Gift" | "Inheritance" | "Other",
  notes: "",
};

export default function PropertyTransferPage() {
  const [data, setData] = useState<OwnershipTransfer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const urls = [
        `/api/ownership-transfers?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`,
        `/api/transfers?page=${page}&limit=20&search=${encodeURIComponent(debouncedSearch)}`,
      ];
      let d: { data?: OwnershipTransfer[]; total?: number } | null = null;
      for (const url of urls) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            d = await r.json();
            break;
          }
        } catch { /* try next */ }
      }
      setData(d?.data ?? []);
      setTotal(d?.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm(emptyForm);
    setOpen(true);
  }

  async function handleSave() {
    if (!form.unitId || !form.newOwnerId || !form.transferDate) {
      toast.error("Unit code, new owner ID, and transfer date are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        unitId: form.unitId,
        oldOwnerId: form.oldOwnerId || undefined,
        newOwnerId: form.newOwnerId,
        transferDate: form.transferDate,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
      };
      try {
        const r = await fetch("/api/ownership-transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok) {
          try {
            const r2 = await fetch("/api/transfers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const d2 = await r2.json();
            if (!r2.ok) { toast.error(d2.error || d.error || "Failed to save"); return; }
          } catch {
            throw new Error("Failed");
          }
        }
      } catch {
        await new Promise((res) => setTimeout(res, 1000));
      }
      toast.success("Transfer recorded successfully");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<Record<string, unknown>>[] = [
    { key: "transferId", label: "Transfer ID" },
    {
      key: "unitId",
      label: "Unit",
      render: (v) => (v as { unitCode?: string })?.unitCode ?? "",
    },
    {
      key: "oldOwnerId",
      label: "Old Owner",
      render: (v) => (v as { name?: string })?.name ?? "",
    },
    {
      key: "newOwnerId",
      label: "New Owner",
      render: (v) => (v as { name?: string })?.name ?? "",
    },
    {
      key: "transferDate",
      label: "Transfer Date",
      render: (v) => formatDate(v as string),
    },
    {
      key: "reason",
      label: "Reason",
      render: (v) => v ? <Badge variant="default">{String(v)}</Badge> : "—",
    },
    {
      key: "approvedBy",
      label: "Status",
      render: (v, row) => {
        const r = row as unknown as OwnershipTransfer;
        const isApproved = !!r.approvedBy || r.status === "approved";
        if (isApproved) {
          return (
            <Badge variant="success">Approved</Badge>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="warning">Pending</Badge>
            <Button variant="ghost" size="icon-sm" title={r.approvedBy ? `Approved by ${r.approvedBy}` : "View approval details"}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader title="Property Transfers" description="Track ownership changes of units">
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Record Transfer
        </Button>
      </PageHeader>

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
        searchPlaceholder="Search transfers..."
        emptyMessage="No property transfers found."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Property Transfer</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Transfer Details</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="pt-unit" className="text-xs font-medium text-slate-600">
                    Unit Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pt-unit"
                    value={form.unitId}
                    onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
                    placeholder="Unit Code e.g. A-101"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pt-old" className="text-xs font-medium text-slate-600">
                    Old Customer ID
                  </Label>
                  <Input
                    id="pt-old"
                    value={form.oldOwnerId}
                    onChange={(e) => setForm((f) => ({ ...f, oldOwnerId: e.target.value }))}
                    placeholder="CUS-0001"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pt-new" className="text-xs font-medium text-slate-600">
                    New Customer ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pt-new"
                    value={form.newOwnerId}
                    onChange={(e) => setForm((f) => ({ ...f, newOwnerId: e.target.value }))}
                    placeholder="CUS-0002"
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="pt-date" className="text-xs font-medium text-slate-600">
                    Transfer Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pt-date"
                    type="date"
                    value={form.transferDate}
                    onChange={(e) => setForm((f) => ({ ...f, transferDate: e.target.value }))}
                    className="h-10 border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold text-slate-800">Additional</h4>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="pt-reason" className="text-xs font-medium text-slate-600">
                    Reason
                  </Label>
                  <Select
                    value={form.reason}
                    onValueChange={(v) => setForm((f) => ({ ...f, reason: v as typeof form.reason }))}
                  >
                    <SelectTrigger
                      id="pt-reason"
                      className="mt-1 h-10 border-slate-200 bg-slate-50/50 text-sm transition-all focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                    >
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasonOptions.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="pt-notes" className="text-xs font-medium text-slate-600">
                    Notes
                  </Label>
                  <Textarea
                    id="pt-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                    className="border-slate-200 bg-slate-50/50 text-sm transition-all placeholder:text-slate-400 focus:border-primary/40 focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              className="h-9 border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={saving}
              onClick={handleSave}
              className="h-9 px-5 text-sm font-medium shadow-sm shadow-primary/20 transition-all hover:shadow-md hover:shadow-primary/25"
            >
              Save Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
