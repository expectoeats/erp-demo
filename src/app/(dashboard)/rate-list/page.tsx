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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

interface RateList {
  _id: string;
  locationId: { _id: string; name: string };
  subLocationId?: { _id: string; name: string };
  serviceId: { _id: string; name: string };
  financialYearId: { _id: string; name: string };
  rate: number;
  unit: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

interface Location {
  _id: string;
  name: string;
}
interface SubLocation {
  _id: string;
  name: string;
}
interface Service {
  _id: string;
  name: string;
}
interface FinancialYear {
  _id: string;
  name: string;
}

const emptyForm = {
  locationId: "",
  subLocationId: "",
  serviceId: "",
  financialYearId: "",
  rate: "",
  unit: "",
  effectiveFrom: "",
  effectiveTo: "",
  isActive: true,
};

export default function RateListMasterPage() {
  const [data, setData] = useState<RateList[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);

  const [locations, setLocations] = useState<Location[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RateList | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/rate-lists?search=${encodeURIComponent(debouncedSearch)}&page=${page}&limit=20`
      );
      const d = await r.json();
      setData(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/locations?limit=100")
      .then((r) => r.json())
      .then((d) => setLocations(d.data ?? []));
    fetch("/api/services?limit=100")
      .then((r) => r.json())
      .then((d) => setServices(d.data ?? []));
    fetch("/api/financial-years?limit=50")
      .then((r) => r.json())
      .then((d) => setFinancialYears(d.data ?? []));
  }, []);

  useEffect(() => {
    if (form.locationId) {
      fetch(`/api/sub-locations?locationId=${form.locationId}&limit=100`)
        .then((r) => r.json())
        .then((d) => setSubLocations(d.data ?? []));
    } else {
      setSubLocations([]);
    }
  }, [form.locationId]);

  function resetForm() {
    setForm(emptyForm);
  }

  async function handleSave() {
    if (
      !form.locationId ||
      !form.serviceId ||
      !form.financialYearId ||
      !form.rate ||
      !form.unit ||
      !form.effectiveFrom
    ) {
      toast.error("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        rate: parseFloat(form.rate),
        effectiveTo: form.effectiveTo || undefined,
      };
      const url = editing ? `/api/rate-lists/${editing._id}` : "/api/rate-lists";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed to save");
        return;
      }
      toast.success("Rate list saved successfully");
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

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
      label: "FY",
      render: (v) => (v as { name: string })?.name ?? "",
    },
    {
      key: "rate",
      label: "Rate",
      render: (v, row) =>
        `${formatCurrency(v as number)}/${String((row as RateList).unit ?? "unit")}`,
    },
    {
      key: "effectiveFrom",
      label: "From",
      render: (v) => formatDate(v as string),
    },
    {
      key: "effectiveTo",
      label: "To",
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
    {
      key: "_id",
      label: "",
      render: (_, row) => (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            const rl = row as unknown as RateList;
            setEditing(rl);
            setForm({
              locationId:
                (rl.locationId as unknown as { _id: string })?._id ?? "",
              subLocationId: rl.subLocationId
                ? (rl.subLocationId as unknown as { _id: string })._id
                : "",
              serviceId: (rl.serviceId as unknown as { _id: string })?._id ?? "",
              financialYearId:
                (rl.financialYearId as unknown as { _id: string })?._id ?? "",
              rate: String(rl.rate ?? ""),
              unit: rl.unit ?? "",
              effectiveFrom: rl.effectiveFrom
                ? new Date(rl.effectiveFrom).toISOString().split("T")[0]
                : "",
              effectiveTo: rl.effectiveTo
                ? new Date(rl.effectiveTo).toISOString().split("T")[0]
                : "",
              isActive: rl.isActive,
            });
            setOpen(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Rate List Master"
        description="Manage service rates and charges"
      >
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            resetForm();
            setOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Rate
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
        searchPlaceholder="Search location, service..."
        emptyMessage="No rate lists found. Add rates to start billing."
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rate" : "Add Rate"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Location *</Label>
              <Select
                value={form.locationId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, locationId: v, subLocationId: "" }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Sub Location</Label>
              <Select
                value={form.subLocationId}
                onValueChange={(v) => setForm((f) => ({ ...f, subLocationId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select sub location" />
                </SelectTrigger>
                <SelectContent>
                  {subLocations.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Service *</Label>
              <Select
                value={form.serviceId}
                onValueChange={(v) => setForm((f) => ({ ...f, serviceId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Financial Year *</Label>
              <Select
                value={form.financialYearId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, financialYearId: v }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select FY" />
                </SelectTrigger>
                <SelectContent>
                  {financialYears.map((fy) => (
                    <SelectItem key={fy._id} value={fy._id}>
                      {fy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rate *</Label>
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                placeholder="10.00"
              />
            </div>
            <div>
              <Label>Unit *</Label>
              <Input
                className="mt-1"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="sq.ft / kWh / unit"
              />
            </div>
            <div>
              <Label>Effective From *</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effectiveFrom: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Effective To</Label>
              <Input
                className="mt-1"
                type="date"
                value={form.effectiveTo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effectiveTo: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
