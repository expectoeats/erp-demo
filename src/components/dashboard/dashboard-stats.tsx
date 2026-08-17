"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import {
  Users, Building2, FileText, DollarSign, AlertCircle, Receipt, TrendingUp, Home,
} from "lucide-react";

interface StatsData {
  totalCustomers: number;
  totalUnits: number;
  activeUnits: number;
  vacantUnits: number;
  currentMonthBilling: number;
  currentMonthCollection: number;
  outstanding: number;
  overdueAmount: number;
  totalReceipts: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, color, sub }: StatCardProps) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold text-foreground mt-1">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="h-4 bg-muted animate-pulse rounded w-3/4 mb-2" />
              <div className="h-7 bg-muted animate-pulse rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const s = stats;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <StatCard label="Total Customers" value={s?.totalCustomers ?? 0} icon={Users} color="bg-blue-50 text-blue-600" />
      <StatCard label="Total Units" value={s?.totalUnits ?? 0} icon={Building2} color="bg-purple-50 text-purple-600" />
      <StatCard label="Active Units" value={s?.activeUnits ?? 0} icon={Home} color="bg-emerald-50 text-emerald-600" sub={`${s?.vacantUnits ?? 0} vacant`} />
      <StatCard label="Month Billing" value={formatCurrency(s?.currentMonthBilling ?? 0)} icon={FileText} color="bg-amber-50 text-amber-600" />
      <StatCard label="Month Collection" value={formatCurrency(s?.currentMonthCollection ?? 0)} icon={TrendingUp} color="bg-teal-50 text-teal-600" />
      <StatCard label="Outstanding" value={formatCurrency(s?.outstanding ?? 0)} icon={AlertCircle} color="bg-orange-50 text-orange-600" />
      <StatCard label="Overdue" value={formatCurrency(s?.overdueAmount ?? 0)} icon={AlertCircle} color="bg-red-50 text-red-600" />
      <StatCard label="Total Receipts" value={s?.totalReceipts ?? 0} icon={Receipt} color="bg-sky-50 text-sky-600" />
      <StatCard label="Net Collected" value={formatCurrency(s?.currentMonthCollection ?? 0)} icon={DollarSign} color="bg-green-50 text-green-600" />
    </div>
  );
}
