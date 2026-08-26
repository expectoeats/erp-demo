"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
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
  X,
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
      { label: "Clients", href: "/masters/customers", icon: Users },
      { label: "Financial Years", href: "/masters/financial-years", icon: CalendarDays },
      { label: "New Bills", href: "/masters/new-bills", icon: FileText },
      { label: "Bill List", href: "/masters/bill-list", icon: ScrollText },
    ],
  },
  {
    label: "Setup",
    icon: Settings,
    children: [
      { label: "Organisation Settings", href: "/setup/organisation", icon: Building },
    ],
  },
  {
    label: "Transactions",
    icon: CreditCard,
    children: [
      { label: "Generate Bills", href: "/transactions/generate-bill", icon: FileText },
      { label: "Payments", href: "/transactions/payments", icon: CreditCard },
      { label: "Receipts", href: "/transactions/receipts", icon: Receipt },
      { label: "Vouchers", href: "/transactions/vouchers", icon: BookOpen },
      { label: "Property Transfer", href: "/transactions/property-transfer", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Reports",
    icon: BarChart2,
    children: [
      { label: "Client Ledger", href: "/reports/customer-ledger", icon: BookOpen },
      { label: "Collection Report", href: "/reports/collection", icon: TrendingUp },
      { label: "Billing Report", href: "/reports/billing", icon: FileBarChart },
      { label: "Outstanding Report", href: "/reports/outstanding", icon: AlertCircle },
      { label: "Defaulter Report", href: "/reports/defaulters", icon: UserCheck },
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
  onNavigate?: () => void;
}

function SidebarGroup({ item, level = 0, onNavigate }: SidebarGroupProps) {
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
            <SidebarNavItem key={child.href} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SidebarNavItem({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = item.href
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : false;
  const Icon = item.icon;

  if (item.children) return <SidebarGroup item={item} onNavigate={onNavigate} />;

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
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

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full w-56 sidebar-bg flex flex-col z-40 border-r sidebar-border transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Header - Display ONLY logo, centered with transparent background */}
      <div className="h-16 flex items-center justify-between px-4 border-b sidebar-border shrink-0">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex-1 flex items-center justify-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.jpeg"
            alt="Logo"
            className="h-11 w-auto max-w-[170px] object-contain rounded"
          />
        </Link>

        {/* Mobile close button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 ml-2"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2 flex flex-col gap-0.5">
        {navItems.map((item) =>
          item.children ? (
            <SidebarGroup key={item.label} item={item} onNavigate={onClose} />
          ) : (
            <SidebarNavItem key={item.href} item={item} onNavigate={onClose} />
          )
        )}
      </nav>
    </aside>
  );
}
