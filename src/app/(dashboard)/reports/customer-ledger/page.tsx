"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Download,
  Search,
  BookOpen,
  TrendingDown,
  Wallet,
  FileText,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  Users,
  TrendingUp,
  Building2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  mobile?: string;
  email?: string;
  isActive: boolean;
  billingType?: string;
  orgId?: { companyName?: string; orgCode?: string } | null;
}

interface FinancialYear {
  _id: string;
  name: string;
  isActive: boolean;
}

interface LedgerRow {
  date: string;
  particular: string;
  type: string;
  invoiceNumber: string;
  billingPeriod: string;
  debit: number;
  credit: number;
  balance: number;
  status: string;
}

interface LedgerSummary {
  customer: {
    name: string;
    customerId: string;
    mobile?: string;
    email?: string;
  };
  summary: {
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
    billCount: number;
    receiptCount: number;
  };
  ledger: LedgerRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeConfig: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    badgeVariant: "default" | "success" | "warning" | "destructive" | "muted" | "info";
  }
> = {
  Invoice: { label: "Invoice", icon: ArrowUpRight, badgeVariant: "warning" },
  Payment: { label: "Payment", icon: ArrowDownLeft, badgeVariant: "success" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientLedgerPage() {
  // Client list
  const [customers, setCustomers]           = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [clientSearch, setClientSearch]     = useState("");
  const debouncedSearch                     = useDebounce(clientSearch, 300);

  // Selected client & ledger
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [financialYears, setFinancialYears]     = useState<FinancialYear[]>([]);
  const [selectedFy, setSelectedFy]             = useState<string>("all");
  const [ledger, setLedger]                     = useState<LedgerSummary | null>(null);
  const [loadingLedger, setLoadingLedger]       = useState(false);
  const [downloading, setDownloading]           = useState(false);
  const [expandedRows, setExpandedRows]         = useState<Set<number>>(new Set());

  // ── Load all customers ──────────────────────────────────────────────────
  const loadCustomers = useCallback(async (search: string) => {
    setCustomersLoading(true);
    try {
      const res = await fetch(
        `/api/customers?search=${encodeURIComponent(search)}&limit=100`
      );
      const d = await res.json();
      setCustomers(d.data ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers(debouncedSearch);
  }, [debouncedSearch, loadCustomers]);

  // ── Load financial years ────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/financial-years")
      .then((r) => r.json())
      .then((d) => {
        const fys: FinancialYear[] = d.data ?? [];
        setFinancialYears(fys);
        const active = fys.find((f) => f.isActive);
        if (active) setSelectedFy(active._id);
      })
      .catch(() => {});
  }, []);

  // ── Load ledger ─────────────────────────────────────────────────────────
  const loadLedger = useCallback(async (customerId: string, fyId: string) => {
    setLoadingLedger(true);
    setLedger(null);
    setExpandedRows(new Set());
    try {
      const qs = fyId !== "all" ? `?format=json&financialYearId=${fyId}` : "?format=json";
      const res = await fetch(`/api/customers/${customerId}/ledger${qs}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Failed to load ledger");
        return;
      }
      setLedger(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load ledger");
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCustomer) loadLedger(selectedCustomer._id, selectedFy);
  }, [selectedCustomer, selectedFy, loadLedger]);

  // ── Excel download ──────────────────────────────────────────────────────
  async function handleDownload() {
    if (!selectedCustomer) return;
    setDownloading(true);
    try {
      const qs =
        selectedFy !== "all"
          ? `?format=excel&financialYearId=${selectedFy}`
          : "?format=excel";
      const res = await fetch(`/api/customers/${selectedCustomer._id}/ledger${qs}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Download failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      a.download = match?.[1] ?? `Ledger_${selectedCustomer.customerId}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Ledger exported successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function toggleRow(i: number) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  const fyLabel =
    selectedFy === "all"
      ? "All Years"
      : financialYears.find((f) => f._id === selectedFy)?.name ?? "";

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full gap-0">
      <PageHeader
        title="Client Ledger"
        description="Select a client to view their complete billing and payment history"
      >
        {selectedCustomer && ledger && (
          <div className="flex items-center gap-2">
            <Select value={selectedFy} onValueChange={setSelectedFy}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="Financial Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Financial Years</SelectItem>
                {financialYears.map((fy) => (
                  <SelectItem key={fy._id} value={fy._id}>
                    {fy.name}
                    {fy.isActive && (
                      <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">
                        ● Active
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-1.5 h-8"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export Excel
            </Button>
          </div>
        )}
      </PageHeader>

      {/* ── Split layout ──────────────────────────────────────────────────── */}
      <div className="flex gap-4 mt-4" style={{ minHeight: "calc(100vh - 180px)" }}>

        {/* ── LEFT PANEL — Client list ──────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/80">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search clients…"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-white"
              />
            </div>
          </div>

          {/* List header */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Clients
              {!customersLoading && (
                <span className="font-normal text-slate-400">({customers.length})</span>
              )}
            </span>
            {customersLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
            )}
          </div>

          {/* Client cards */}
          <div className="flex-1 overflow-y-auto">
            {customersLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="px-3 py-3 border-b border-slate-50 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <Users className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">No clients found</p>
              </div>
            ) : (
              customers.map((c) => {
                const isSelected = selectedCustomer?._id === c._id;
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => setSelectedCustomer(c)}
                    className={`w-full flex items-center gap-2.5 px-3 py-3 border-b border-slate-50 transition-all text-left group
                      ${isSelected
                        ? "bg-primary/8 border-l-2 border-l-primary"
                        : "hover:bg-slate-50 border-l-2 border-l-transparent"
                      }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors
                        ${isSelected
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary"
                        }`}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-semibold truncate ${
                          isSelected ? "text-primary" : "text-slate-800"
                        }`}
                      >
                        {c.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {c.customerId}
                        {c.mobile && <span className="ml-1 not-italic">· {c.mobile}</span>}
                      </p>
                    </div>

                    {/* Status dot */}
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        c.isActive ? "bg-emerald-400" : "bg-slate-300"
                      }`}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL — Ledger ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-auto">

          {/* No client selected */}
          {!selectedCustomer && (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
              <div className="p-5 rounded-full bg-primary/5 mb-4">
                <BookOpen className="h-12 w-12 text-primary/30" />
              </div>
              <p className="text-base font-semibold text-slate-500 mb-1">
                Select a client
              </p>
              <p className="text-sm text-slate-400">
                Click any client from the left panel to view their ledger
              </p>
            </div>
          )}

          {/* Loading */}
          {selectedCustomer && loadingLedger && (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-3" />
              <p className="text-sm text-slate-400 animate-pulse">
                Loading ledger for {selectedCustomer.name}…
              </p>
            </div>
          )}

          {/* Ledger content */}
          {selectedCustomer && ledger && !loadingLedger && (
            <>
              {/* Client header card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <div className="px-5 py-3.5 bg-gradient-to-r from-primary/5 to-transparent flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {ledger.customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-tight">
                        {ledger.customer.name}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-400">
                        {ledger.customer.customerId}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {ledger.customer.mobile && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {ledger.customer.mobile}
                      </span>
                    )}
                    {ledger.customer.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-slate-400" />
                        {ledger.customer.email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {fyLabel}
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-slate-400 hover:text-primary transition-colors"
                      onClick={() => loadLedger(selectedCustomer._id, selectedFy)}
                      title="Refresh"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Summary stats strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-slate-100 border-t border-slate-100">
                  {[
                    {
                      label: "Total Billed",
                      value: formatCurrency(ledger.summary.totalBilled),
                      icon: <FileText className="h-3.5 w-3.5" />,
                      bg: "bg-blue-50/60",
                      text: "text-blue-700",
                      iconCls: "bg-blue-100 text-blue-500",
                    },
                    {
                      label: "Total Paid",
                      value: formatCurrency(ledger.summary.totalPaid),
                      icon: <TrendingDown className="h-3.5 w-3.5" />,
                      bg: "bg-emerald-50/60",
                      text: "text-emerald-700",
                      iconCls: "bg-emerald-100 text-emerald-500",
                    },
                    {
                      label: "Outstanding",
                      value: formatCurrency(ledger.summary.outstanding),
                      icon: <Wallet className="h-3.5 w-3.5" />,
                      bg: ledger.summary.outstanding > 0 ? "bg-red-50/60" : "bg-slate-50/60",
                      text: ledger.summary.outstanding > 0 ? "text-red-700" : "text-slate-600",
                      iconCls:
                        ledger.summary.outstanding > 0
                          ? "bg-red-100 text-red-500"
                          : "bg-slate-100 text-slate-400",
                    },
                    {
                      label: "Invoices",
                      value: String(ledger.summary.billCount),
                      icon: <TrendingUp className="h-3.5 w-3.5" />,
                      bg: "bg-indigo-50/60",
                      text: "text-indigo-700",
                      iconCls: "bg-indigo-100 text-indigo-500",
                    },
                    {
                      label: "Receipts",
                      value: String(ledger.summary.receiptCount),
                      icon: <Building2 className="h-3.5 w-3.5" />,
                      bg: "bg-violet-50/60",
                      text: "text-violet-700",
                      iconCls: "bg-violet-100 text-violet-500",
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`flex items-center gap-2.5 px-4 py-3 ${stat.bg}`}
                    >
                      <div className={`p-1.5 rounded-lg ${stat.iconCls}`}>{stat.icon}</div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                          {stat.label}
                        </p>
                        <p className={`text-xs font-bold ${stat.text} tabular-nums`}>
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* FY selector (shown inline when no client header buttons) */}
              {!selectedCustomer && (
                <div className="flex items-center gap-2">
                  <Select value={selectedFy} onValueChange={setSelectedFy}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="Financial Year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Financial Years</SelectItem>
                      {financialYears.map((fy) => (
                        <SelectItem key={fy._id} value={fy._id}>
                          {fy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Ledger table */}
              {ledger.ledger.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-slate-200 bg-slate-50">
                  <AlertCircle className="h-7 w-7 text-slate-300 mb-2" />
                  <p className="text-sm font-medium text-slate-500">No transactions found</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    No bills or payments recorded{selectedFy !== "all" ? ` for ${fyLabel}` : ""}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                  {/* Table toolbar */}
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-primary" />
                      Transaction Ledger
                      <span className="font-normal text-slate-400 normal-case tracking-normal">
                        ({ledger.ledger.length} entries)
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[11px] gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={handleDownload}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Download Excel
                    </Button>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[120px_1fr_140px_110px_110px_110px] border-b border-slate-100 bg-muted/30 px-4 py-2">
                    {["Date", "Particular", "Invoice No", "Debit (₹)", "Credit (₹)", "Balance (₹)"].map(
                      (h) => (
                        <span
                          key={h}
                          className="text-[10px] font-bold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </span>
                      )
                    )}
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-slate-100">
                    {ledger.ledger.map((row, i) => {
                      const cfg = typeConfig[row.type] ?? typeConfig["Invoice"];
                      const Icon = cfg.icon;
                      const isExpanded = expandedRows.has(i);
                      const isDebit = row.type === "Invoice";

                      return (
                        <div key={i}>
                          <button
                            type="button"
                            onClick={() => toggleRow(i)}
                            className="w-full grid grid-cols-[120px_1fr_140px_110px_110px_110px] px-4 py-2.5 hover:bg-slate-50/60 transition-colors text-left items-center"
                          >
                            <span className="text-[11px] text-slate-500">{row.date}</span>

                            <span className="flex items-center gap-2 min-w-0">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${
                                  isDebit
                                    ? "bg-red-100 text-red-500"
                                    : "bg-emerald-100 text-emerald-600"
                                }`}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {row.particular}
                              </span>
                              {row.billingPeriod && (
                                <span className="text-[10px] text-slate-400 hidden lg:inline shrink-0">
                                  · {row.billingPeriod}
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="h-2.5 w-2.5 text-slate-400 ml-auto shrink-0" />
                              ) : (
                                <ChevronRight className="h-2.5 w-2.5 text-slate-400 ml-auto shrink-0" />
                              )}
                            </span>

                            <span className="text-[11px] font-mono text-slate-500 truncate">
                              {row.invoiceNumber || "—"}
                            </span>

                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                row.debit ? "text-red-600" : "text-slate-300"
                              }`}
                            >
                              {row.debit ? formatCurrency(row.debit) : "—"}
                            </span>

                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                row.credit ? "text-emerald-600" : "text-slate-300"
                              }`}
                            >
                              {row.credit ? formatCurrency(row.credit) : "—"}
                            </span>

                            <span
                              className={`text-xs font-bold tabular-nums ${
                                row.balance > 0
                                  ? "text-red-600"
                                  : row.balance < 0
                                  ? "text-emerald-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {row.balance > 0
                                ? `${formatCurrency(row.balance)} Dr`
                                : row.balance < 0
                                ? `${formatCurrency(Math.abs(row.balance))} Cr`
                                : formatCurrency(0)}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {row.billingPeriod && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    Billing Period
                                  </p>
                                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                                    {row.billingPeriod}
                                  </p>
                                </div>
                              )}
                              {row.invoiceNumber && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    Reference
                                  </p>
                                  <p className="text-xs font-mono font-semibold text-slate-700 mt-0.5">
                                    {row.invoiceNumber}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                  Type
                                </p>
                                <Badge
                                  variant={cfg.badgeVariant}
                                  className="mt-0.5 text-[10px]"
                                >
                                  {cfg.label}
                                </Badge>
                              </div>
                              {row.status && row.type === "Invoice" && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    Status
                                  </p>
                                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                                    {row.status}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer totals */}
                  <div className="px-4 py-3 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white flex flex-wrap justify-end gap-5">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
                        Total Billed
                      </p>
                      <p className="text-sm font-bold text-red-600 tabular-nums">
                        {formatCurrency(ledger.summary.totalBilled)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
                        Total Paid
                      </p>
                      <p className="text-sm font-bold text-emerald-600 tabular-nums">
                        {formatCurrency(ledger.summary.totalPaid)}
                      </p>
                    </div>
                    <div className="h-7 w-px bg-slate-200 self-center hidden sm:block" />
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
                        Net Outstanding
                      </p>
                      <p
                        className={`text-sm font-extrabold tabular-nums ${
                          ledger.summary.outstanding > 0
                            ? "text-red-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {formatCurrency(ledger.summary.outstanding)}
                        {ledger.summary.outstanding > 0
                          ? " Dr"
                          : ledger.summary.outstanding < 0
                          ? " Cr"
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
