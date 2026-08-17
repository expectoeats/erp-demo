"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap, Calculator, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ElectricitySetupPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultRate: "3.50",
    minConsumption: "0",
    meterReadingCycle: "Monthly",
    tariffSlabs: "0-100 : 3.50\n101-200 : 4.20\n201-300 : 5.00\n301+ : 6.00",
    fixedCharge: "50",
    demandCharge: "",
    lateFeeRate: "10",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Electricity setup saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Electricity Setup" description="Configure electricity billing defaults" />
      <Card>
        <CardHeader>
          <CardTitle>Electricity Billing</CardTitle>
          <CardDescription>Set up metering defaults, tariff slabs, and standard charges.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center px-0">
                <Zap className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Metering Defaults</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Default Rate (₹/unit)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.defaultRate}
                  onChange={(e) => setForm((f) => ({ ...f, defaultRate: e.target.value }))}
                  placeholder="3.50"
                />
              </div>
              <div>
                <Label>Min Consumption (units)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  value={form.minConsumption}
                  onChange={(e) => setForm((f) => ({ ...f, minConsumption: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Meter Reading Cycle</Label>
                <Select value={form.meterReadingCycle} onValueChange={(v) => setForm((f) => ({ ...f, meterReadingCycle: v }))}>
                  <SelectTrigger className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center px-0">
                <Calculator className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Tariff Slabs</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div>
              <Label>Slab Rates</Label>
              <Textarea
                className="mt-1 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10 font-mono text-xs"
                rows={6}
                value={form.tariffSlabs}
                onChange={(e) => setForm((f) => ({ ...f, tariffSlabs: e.target.value }))}
                placeholder="Enter slabs one per line, e.g.&#10;0-100 : 3.50&#10;101-200 : 4.20&#10;201-300 : 5.00&#10;301+ : 6.00"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Format: range : rate per unit</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center px-0">
                <FileText className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Other Charges</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Fixed Charge (₹)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.fixedCharge}
                  onChange={(e) => setForm((f) => ({ ...f, fixedCharge: e.target.value }))}
                  placeholder="50"
                />
              </div>
              <div>
                <Label>Demand Charge (₹)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.demandCharge}
                  onChange={(e) => setForm((f) => ({ ...f, demandCharge: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </div>
              <div>
                <Label>Late Fee Rate (₹/day)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.lateFeeRate}
                  onChange={(e) => setForm((f) => ({ ...f, lateFeeRate: e.target.value }))}
                  placeholder="10"
                />
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" size="sm" loading={saving} onClick={handleSubmit}>
            Save
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
