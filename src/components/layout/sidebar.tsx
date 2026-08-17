"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  MapPin,
  Map,
  Users,
  Building2,
  Wrench,
  Gauge,
  List,
  FileText,
  Settings,
  ChevronDown,
  ChevronRight,
  Receipt,
  CreditCard,
  BarChart2,
  ArrowLeftRight,
  BookOpen,
  TrendingUp,
  AlertCircle,
  FileBarChart,
  Shield,
  Building,
  CalendarDays,
  DollarSign,
  Zap,
  Droplets,
  ScrollText,
  PieChart,
  UserCheck,
} from "lucide-react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    label: "Masters",
    icon: Building,
    children: [
      { label: "Locations", href: "/masters/locations", icon: MapPin },
      { label: "Sub Locations", href: "/masters/sub-locations", icon: Map },
      { label: "Customers", href: "/masters/customers", icon: Users },
      { label: "Units / Properties", href: "/masters/units", icon: Building2 },
      { label: "Services", href: "/masters/services", icon: Wrench },
      { label: "Meters", href: "/masters/meters", icon: Gauge },
      { label: "Rate Lists", href: "/masters/rate-lists", icon: List },
      { label: "Bill Types", href: "/masters/bill-types", icon: FileText },
      { label: "Financial Years", href: "/masters/financial-years", icon: CalendarDays },
    ],
  },
  {
    label: "Setup",
    icon: Settings,
    children: [
      { label: "Tax / GST Config", href: "/setup/tax", icon: DollarSign },
      { label: "Electricity Setup", href: "/setup/electricity", icon: Zap },
      { label: "Water Setup", href: "/setup/water", icon: Droplets },
      { label: "Organisation Settings", href: "/setup/organisation", icon: Building },
    ],
  },
  {
    label: "Transactions",
    icon: CreditCard,
    children: [
      { label: "Generate Bills", href: "/transactions/generate-bill", icon: FileText },
      { label: "Bills", href: "/transactions/bills", icon: ScrollText },
      { label: "Payments", href: "/transactions/payments", icon: CreditCard },
      { label: "Receipts", href: "/transactions/receipts", icon: Receipt },
      { label: "Meter Readings", href: "/transactions/meter-readings", icon: Gauge },
      { label: "Vouchers", href: "/transactions/vouchers", icon: BookOpen },
      { label: "Property Transfer", href: "/transactions/property-transfer", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Reports",
    icon: BarChart2,
    children: [
      { label: "Customer Ledger", href: "/reports/customer-ledger", icon: BookOpen },
      { label: "Collection Report", href: "/reports/collection", icon: TrendingUp },
      { label: "Billing Report", href: "/reports/billing", icon: FileBarChart },
      { label: "Outstanding Report", href: "/reports/outstanding", icon: AlertCircle },
      { label: "Defaulter Report", href: "/reports/defaulters", icon: UserCheck },
      { label: "Unit Report", href: "/reports/units", icon: Building2 },
      { label: "Rate List Report", href: "/reports/rate-list", icon: List },
      { label: "MIS Summary", href: "/reports/mis", icon: PieChart },
      { label: "Receipt Report", href: "/reports/receipts", icon: Receipt },
      { label: "Transfer Report", href: "/reports/transfers", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Administration",
    icon: Shield,
    children: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
      { label: "Change Password", href: "/admin/change-password", icon: Settings },
    ],
  },
];

interface SidebarGroupProps {
  item: NavItem;
  level?: number;
}

function SidebarGroup({ item, level = 0 }: SidebarGroupProps) {
  const pathname = usePathname();
  const isChildActive = item.children?.some(
    (c) => c.href && pathname.startsWith(c.href)
  );
  const [open, setOpen] = useState(isChildActive ?? false);
  const Icon = item.icon;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm sidebar-hover transition-colors",
          "sidebar-fg",
          isChildActive && "sidebar-fg opacity-100"
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-70" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
        )}
      </button>

      {open && (
        <div className="ml-3 mt-0.5 border-l border-white/10 pl-3 flex flex-col gap-0.5">
          {item.children?.map((child) => (
            <SidebarNavItem key={child.href} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNavItem({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + "/") : false;
  const Icon = item.icon;

  if (item.children) return <SidebarGroup item={item} />;

  return (
    <Link
      href={item.href!}
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors",
        isActive
          ? "sidebar-active"
          : "sidebar-fg opacity-80 sidebar-hover"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-56 sidebar-bg flex flex-col z-30 border-r sidebar-border">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b sidebar-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white leading-none">PropertyERP</div>
            <div className="text-[10px] sidebar-muted mt-0.5">Management System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 flex flex-col gap-0.5">
        {navItems.map((item) =>
          item.children ? (
            <SidebarGroup key={item.label} item={item} />
          ) : (
            <SidebarNavItem key={item.href} item={item} />
          )
        )}
      </nav>
    </aside>
  );
}
