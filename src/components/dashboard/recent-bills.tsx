"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface RecentBill {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  unitCode: string;
  grandTotal: number;
  status: string;
  invoiceDate: string;
}

const statusVariants: Record<string, "default" | "success" | "warning" | "destructive" | "muted"> = {
  unpaid: "warning",
  partially_paid: "info" as "default",
  paid: "success",
  overdue: "destructive",
  cancelled: "muted",
};

export function RecentBills({ initialData }: { initialData?: RecentBill[] }) {
  const [bills, setBills] = useState<RecentBill[]>(() => {
    if (initialData && initialData.length > 0) return initialData;
    try {
      const cached = sessionStorage.getItem("dashboard:recent-bills");
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 30000 && Array.isArray(data) && data.length > 0) return data as RecentBill[];
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (initialData && initialData.length > 0) return false;
    try {
      const cached = sessionStorage.getItem("dashboard:recent-bills");
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 30000 && Array.isArray(data) && data.length > 0) return false;
      }
    } catch {}
    return true;
  });

  useEffect(() => {
    let mounted = true;
    fetch("/api/dashboard/recent-bills", { cache: "no-store" } as RequestInit)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => {
        if (mounted) {
          setBills(d.data ?? []);
          try { sessionStorage.setItem("dashboard:recent-bills", JSON.stringify({ data: d.data ?? [], ts: Date.now() })); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Recent Bills</CardTitle>
        <Link href="/masters/bill-list" className="text-xs text-primary hover:underline">View all</Link>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-muted rounded relative overflow-hidden"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
              </div>
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">No bills yet</div>
        ) : (
          <div className="divide-y">
            {bills.map((b) => (
              <div key={b._id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <div className="text-xs font-medium text-foreground">{b.invoiceNumber}</div>
                  <div className="text-[11px] text-muted-foreground">{b.customerName} · {b.unitCode}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium">{formatCurrency(b.grandTotal)}</div>
                  <Badge variant={statusVariants[b.status] ?? "default"} className="text-[10px] mt-0.5">
                    {b.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
