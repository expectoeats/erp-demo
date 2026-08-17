import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentBills } from "@/components/dashboard/recent-bills";
import { RecentPayments } from "@/components/dashboard/recent-payments";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your property management system"
      />
      <DashboardStats />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <RecentBills />
        <RecentPayments />
      </div>
    </div>
  );
}
