import React from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { RecentBills } from "@/components/dashboard/recent-bills";
import { RecentPayments } from "@/components/dashboard/recent-payments";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/connection";
import Customer from "@/lib/models/Customer";
import Unit from "@/lib/models/Unit";
import Bill from "@/lib/models/Bill";
import Payment from "@/lib/models/Payment";
import Receipt from "@/lib/models/Receipt";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let stats: {
    totalCustomers: number;
    totalUnits: number;
    activeUnits: number;
    vacantUnits: number;
    currentMonthBilling: number;
    currentMonthCollection: number;
    outstanding: number;
    overdueAmount: number;
    totalReceipts: number;
  } | null = null;

  let recentBills: {
    _id: string;
    invoiceNumber: string;
    customerName: string;
    unitCode: string;
    grandTotal: number;
    status: string;
    invoiceDate: string;
  }[] = [];

  let recentPayments: {
    _id: string;
    paymentId: string;
    customerName: string;
    amount: number;
    paymentMode: string;
    paymentDate: string;
  }[] = [];

  try {
    await connectDB();
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [
      [totalCustomers, totalUnits, activeUnits, vacantUnits, billingAgg, collectionAgg, outstandingAgg, overdueAgg, totalReceipts],
      billsRaw,
      paymentsRaw,
    ] = await Promise.all([
      Promise.all([
        Customer.countDocuments({ isActive: true }),
        Unit.countDocuments(),
        Unit.countDocuments({ status: "active" }),
        Unit.countDocuments({ status: "vacant" }),
        Bill.aggregate([
          { $match: { invoiceDate: { $gte: firstOfMonth, $lte: lastOfMonth } } },
          { $group: { _id: null, total: { $sum: "$grandTotal" } } },
        ]),
        Payment.aggregate([
          { $match: { paymentDate: { $gte: firstOfMonth, $lte: lastOfMonth } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Bill.aggregate([
          { $match: { status: { $in: ["unpaid", "partially_paid"] } } },
          { $group: { _id: null, total: { $sum: "$outstandingAmount" } } },
        ]),
        Bill.aggregate([
          { $match: { status: "overdue" } },
          { $group: { _id: null, total: { $sum: "$outstandingAmount" } } },
        ]),
        Receipt.countDocuments(),
      ]),
      Bill.find()
        .select("invoiceNumber grandTotal status invoiceDate customerId unitId")
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("customerId", "name")
        .populate("unitId", "unitCode")
        .lean(),
      Payment.find()
        .select("paymentId amount paymentMode paymentDate customerId")
        .sort({ createdAt: -1 })
        .limit(8)
        .populate("customerId", "name")
        .lean(),
    ]);

    stats = {
      totalCustomers,
      totalUnits,
      activeUnits,
      vacantUnits,
      currentMonthBilling: billingAgg[0]?.total ?? 0,
      currentMonthCollection: collectionAgg[0]?.total ?? 0,
      outstanding: outstandingAgg[0]?.total ?? 0,
      overdueAmount: overdueAgg[0]?.total ?? 0,
      totalReceipts,
    };

    recentBills = JSON.parse(
      JSON.stringify(
        billsRaw.map((b) => ({
          _id: b._id,
          invoiceNumber: b.invoiceNumber,
          customerName: (b.customerId as unknown as { name?: string })?.name ?? "",
          unitCode: (b.unitId as unknown as { unitCode?: string })?.unitCode ?? "",
          grandTotal: b.grandTotal,
          status: b.status,
          invoiceDate: b.invoiceDate,
        })),
      ),
    );

    recentPayments = JSON.parse(
      JSON.stringify(
        paymentsRaw.map((p) => ({
          _id: p._id,
          paymentId: p.paymentId,
          customerName: (p.customerId as unknown as { name?: string })?.name ?? "",
          amount: p.amount,
          paymentMode: p.paymentMode,
          paymentDate: p.paymentDate,
        })),
      ),
    );
  } catch {
    stats = null;
    recentBills = [];
    recentPayments = [];
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your property management system"
      />
      <DashboardStats initialData={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <RecentBills initialData={recentBills} />
        <RecentPayments initialData={recentPayments} />
      </div>
    </div>
  );
}
