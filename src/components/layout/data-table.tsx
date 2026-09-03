"use client";

import React from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: unknown, row: T, index?: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: React.ReactNode;
  actions?: React.ReactNode;
  keyField?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  loading = false,
  totalCount = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  emptyMessage = "No records found.",
  actions,
  keyField = "_id",
}: DataTableProps<T>) {
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      {(onSearchChange || actions) && (
        <div className="flex items-center justify-between gap-3">
          {onSearchChange && (
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              {columns.map((col) => (
                <TableHead key={col.key} className={cn("text-xs", col.className)}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 50}ms` }}>
                  {columns.map((col, colIdx) => {
                    const widths = [
                      "w-3/4", "w-full", "w-5/6", "w-2/3", "w-1/2",
                      "w-4/5", "w-3/5", "w-11/12", "w-2/5",
                    ];
                    const heights = ["h-3.5", "h-4", "h-3", "h-4.5"];
                    const w = widths[(i + colIdx) % widths.length];
                    const h = heights[(i * 2 + colIdx) % heights.length];
                    const isBadgeCol = colIdx === columns.length - 1 ||
                      (col.className && (col.className.includes("Badge") || col.className.includes("badge") || col.label.toLowerCase().includes("status")));
                    return (
                      <TableCell key={col.key}>
                        {isBadgeCol ? (
                          <div className="flex items-center justify-end gap-1">
                            {Array.from({ length: 2 }).map((_, bi) => (
                              <div
                                key={bi}
                                className="h-4 w-4 rounded-full bg-slate-200/60 relative overflow-hidden"
                              >
                                <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className={`${h} ${w} bg-gradient-to-r from-slate-200/70 via-slate-200/50 to-slate-200/70 rounded relative overflow-hidden`}>
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" style={{ animationDelay: `${(i + colIdx) * 100}ms` }} />
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-10">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, rowIdx) => (
                <TableRow key={String(row[keyField] ?? rowIdx)}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={cn("text-xs", col.className)}>
                      {col.render
                        ? col.render(row[col.key], row, rowIdx)
                        : String(row[col.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {Math.min((page - 1) * pageSize + 1, totalCount)}–{Math.min(page * pageSize, totalCount)} of {totalCount}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
