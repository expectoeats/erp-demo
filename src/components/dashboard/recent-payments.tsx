"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

interface RecentPayment {
  _id: string;
  paymentId: string;
  customerName: string;
  amount: number;
  paymentMode: string;
  paymentDate: string;
}

export function RecentPayments() {
  const [payments, setPayments] = useState<RecentPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/recent-payments")
      .then((r) => r.json())
      .then((d) => setPayments(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm">Recent Payments</CardTitle>
        <Link href="/transactions/payments" className="text-xs text-primary hover:underline">View all</Link>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">No payments yet</div>
        ) : (
          <div className="divide-y">
            {payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <div className="text-xs font-medium">{p.paymentId}</div>
                  <div className="text-[11px] text-muted-foreground">{p.customerName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-emerald-600">{formatCurrency(p.amount)}</div>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">{p.paymentMode.replace("_", " ")}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
