"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
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

export function RecentBills() {
  const [bills, setBills] = useState<RecentBill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/recent-bills")
      .then((r) => r.json())
      .then((d) => setBills(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Recent Bills</CardTitle>
        <Link href="/transactions/bills" className="text-xs text-primary hover:underline">View all</Link>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
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
