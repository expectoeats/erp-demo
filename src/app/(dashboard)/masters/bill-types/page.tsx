"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, Column } from "@/components/layout/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Hash,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface BillType {
  _id: string;
  name: string;
  code: string;
  prefix: string;
  lastNumber: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
}

const emptyForm = {
  name: "",
  code: "",
  prefix: "INV",
  description: "",
  isActive: true,
};

export default function BillTypesPage() {
  const [data, setData] = useState<BillType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BillType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bill-types");
      const d = await r.json();
      setData(d.data ?? []);
    } catch {
      toast.error("Failed to load bill types");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(item: BillType) {
    setEditing(item);
    setForm({
      name: item.name,
      code: item.code,
      prefix: item.prefix,
      description: item.description || "",
      isActive: item.isActive,
    });
    setOpen(true);
  }

  async function handleToggleStatus(item: BillType) {
    try {
      const r = await fetch(`/api/bill-types/${item._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to update status");
        return;
      }
      toast.success(
        `Bill Type ${!item.isActive ? "activated" : "deactivated"} successfully`
      );
      load();
    } catch {
      toast.error("Something went wrong");
    }
  }

  async function handleDelete(item: BillType) {
    if (
      !confirm(
        `Are you sure you want to delete or deactivate '${item.name}'?`
      )
    ) {
      return;
    }

    try {
      const r = await fetch(`/api/bill-types/${item._id}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to delete bill type");
        return;
      }
      toast.success(
        d.deactivated
          ? "Bill Type was deactivated because invoices are linked to it."
          : "Bill Type deleted successfully"
      );
      load();
    } catch {
      toast.error("Failed to delete bill type");
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Bill Type Name is required");
      return;
    }
    if (!form.code.trim()) {
      toast.error("Code is required");
      return;
    }
    if (!form.prefix.trim()) {
      toast.error("Prefix is required (e.g. INV, RENT, MAINT)");
      return;
    }

    setSaving(true);
    try {
      const url = editing ? `/api/bill-types/${editing._id}` : "/api/bill-types";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          code: form.code.trim().toUpperCase(),
          prefix: form.prefix.trim().toUpperCase(),
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to save bill type");
        return;
      }
      toast.success(
        editing
          ? "Bill Type updated successfully"
          : "Bill Type created successfully"
      );
      setOpen(false);
      load();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const filteredData = data.filter((item) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.prefix.toLowerCase().includes(q)
    );
  });

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "name",
      label: "Bill Type & Description",
      render: (v, row) => {
        const item = row as unknown as BillType;
        return (
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              <span>{String(v)}</span>
            </div>
            {item.description && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-sm line-clamp-1">
                {item.description}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "code",
      label: "Code",
      render: (v) => (
        <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
          {String(v)}
        </span>
      ),
    },
    {
      key: "prefix",
      label: "Invoice Prefix & Sample Format",
      render: (v, row) => {
        const item = row as unknown as BillType;
        const currentYear = new Date().getFullYear();
        const fyName = `${currentYear}-${String(currentYear + 1).slice(-2)}`;
        const sampleNo = String((item.lastNumber || 0) + 1).padStart(6, "0");
        return (
          <div>
            <span className="font-mono font-semibold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
              {String(v)}
            </span>
            <div className="text-[11px] font-mono text-slate-500 mt-1">
              Sample: <span className="font-semibold text-slate-700">{String(v)}/{fyName}/{sampleNo}</span>
            </div>
          </div>
        );
      },
    },
    {
      key: "lastNumber",
      label: "Bills Issued",
      render: (v) => (
        <div className="flex items-center gap-1 text-xs text-slate-700 font-mono font-medium">
          <Hash className="h-3.5 w-3.5 text-slate-400" />
          <span>{Number(v) || 0}</span>
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (v, row) => {
        const item = row as unknown as BillType;
        return (
          <button
            type="button"
            onClick={() => handleToggleStatus(item)}
            className="cursor-pointer"
            title="Click to toggle status"
          >
            <Badge variant={v ? "success" : "muted"} className="cursor-pointer">
              {v ? "Active" : "Inactive"}
            </Badge>
          </button>
        );
      },
    },
    {
      key: "_id",
      label: "Actions",
      className: "w-24 text-right",
      render: (_, row) => {
        const item = row as unknown as BillType;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit Bill Type"
              className="text-primary hover:bg-primary/10"
              onClick={() => openEdit(item)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Delete / Deactivate"
              className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => handleDelete(item)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bill Types & Numbering Series"
        description="Configure invoice types, automated prefix numbering, and billing categories"
      >
        <Button onClick={openAdd} className="shadow-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add Bill Type
        </Button>
      </PageHeader>

      {/* Top Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
              Total Series
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {data.length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
              Active Series
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {data.filter((d) => d.isActive).length}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
              Total Bills Generated
            </span>
            <div className="text-2xl font-bold text-indigo-600 mt-1">
              {data.reduce((acc, d) => acc + (Number(d.lastNumber) || 0), 0)}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Hash className="h-5 w-5" />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData as unknown as Record<string, unknown>[]}
        loading={loading}
        totalCount={filteredData.length}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search bill type name, code, prefix..."
        emptyMessage="No bill types found. Click 'Add Bill Type' to create one."
      />

      {/* Add / Edit Bill Type Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  {editing ? "Edit Bill Type" : "Add New Bill Type"}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Define invoice title, prefix code, and description.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 bg-white text-sm">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Bill Type Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                className="mt-1.5"
                placeholder="e.g. Standard Invoice / Monthly Maintenance"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Code <span className="text-rose-500">*</span>
                </Label>
                <Input
                  className="mt-1.5 font-mono uppercase"
                  placeholder="e.g. MAINT"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Invoice Prefix <span className="text-rose-500">*</span>
                </Label>
                <Input
                  className="mt-1.5 font-mono uppercase"
                  placeholder="e.g. INV"
                  value={form.prefix}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      prefix: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
            </div>

            {/* Live Invoice Sequence Preview Box */}
            <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg space-y-1">
              <span className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Live Invoice Number Preview:
              </span>
              <p className="font-mono font-bold text-xs text-indigo-900">
                {(form.prefix || "INV").toUpperCase()}/2026-27/000001
              </p>
              <p className="text-[11px] text-slate-500">
                Subsequent invoices will auto-increment (000002, 000003, ...).
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Description (Optional)
              </Label>
              <Textarea
                className="mt-1.5 resize-none text-xs"
                rows={2}
                placeholder="Optional notes regarding this billing series..."
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saving}
              onClick={handleSave}
            >
              {editing ? "Update Bill Type" : "Create Bill Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
