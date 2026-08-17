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
import { Droplet, Calculator, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function WaterSetupPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    defaultRate: "20.00",
    minConsumption: "0",
    readingCycle: "Monthly",
    tariffSlabs: "0-5 : 15.00\n6-15 : 25.00\n16-30 : 35.00\n31+ : 50.00",
    fixedCharge: "30",
    sewerageCharge: "20",
    meterRent: "25",
    lateFeeRate: "5",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Water setup saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Water Setup" description="Configure water billing defaults" />
      <Card>
        <CardHeader>
          <CardTitle>Water Billing</CardTitle>
          <CardDescription>Configure metering defaults, tariff slabs, and standard charges.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center px-0">
                <Droplet className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Metering Defaults</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Default Rate (₹/KL)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.defaultRate}
                  onChange={(e) => setForm((f) => ({ ...f, defaultRate: e.target.value }))}
                  placeholder="20.00"
                />
              </div>
              <div>
                <Label>Min Consumption (KL)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.minConsumption}
                  onChange={(e) => setForm((f) => ({ ...f, minConsumption: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Reading Cycle</Label>
                <Select value={form.readingCycle} onValueChange={(v) => setForm((f) => ({ ...f, readingCycle: v }))}>
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
                placeholder="Enter slabs one per line, e.g.&#10;0-5 : 15.00&#10;6-15 : 25.00&#10;16-30 : 35.00&#10;31+ : 50.00"
              />
              <p className="text-xs text-muted-foreground mt-1.5">Format: range (KL) : rate per KL</p>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center px-0">
                <FileText className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Other Charges</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fixed Charge (₹)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.fixedCharge}
                  onChange={(e) => setForm((f) => ({ ...f, fixedCharge: e.target.value }))}
                  placeholder="30"
                />
              </div>
              <div>
                <Label>Sewerage Charge (%)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.sewerageCharge}
                  onChange={(e) => setForm((f) => ({ ...f, sewerageCharge: e.target.value }))}
                  placeholder="20"
                />
              </div>
              <div>
                <Label>Meter Rent (₹)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  step="0.01"
                  value={form.meterRent}
                  onChange={(e) => setForm((f) => ({ ...f, meterRent: e.target.value }))}
                  placeholder="25"
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
                  placeholder="5"
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
