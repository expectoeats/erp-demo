"use client";

import React from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Settings, Menu } from "lucide-react";
import Link from "next/link";

interface HeaderProps {
  title?: string;
  onOpenSidebar?: () => void;
}

export function Header({ title, onOpenSidebar }: HeaderProps) {
  const { data: session } = useSession();

  const roleLabels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    staff: "Staff",
    accountant: "Accountant",
    viewer: "Viewer",
  };

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-3 sm:px-6 shrink-0 z-20">
      <div className="flex items-center gap-2.5">
        {onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {title && (
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors outline-none cursor-pointer">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-medium text-primary">
                {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-medium leading-none text-foreground">
                {session?.user?.name ?? "User"}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {roleLabels[session?.user?.role ?? ""] ?? session?.user?.role}
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/change-password" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-3.5 w-3.5" />
                Change Password
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
