"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calculator, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function TaxSetupPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    gstinNumber: "",
    defaultGstRate: "18",
    placeOfSupply: "",
    reverseCharge: "No",
    sgstRate: "9",
    cgstRate: "9",
    igstRate: "18",
    tdsRate: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Tax settings saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Tax Settings" description="Configure tax rates and rules" />
      <Card>
        <CardHeader>
          <CardTitle>Tax Setup</CardTitle>
          <CardDescription>Define GST configuration, default tax rates, and TDS percentages.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center px-0">
                <Calculator className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">GST Configuration</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>GSTIN Number</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.gstinNumber}
                  onChange={(e) => setForm((f) => ({ ...f, gstinNumber: e.target.value }))}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div>
                <Label>Default GST Rate (%)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  value={form.defaultGstRate}
                  onChange={(e) => setForm((f) => ({ ...f, defaultGstRate: e.target.value }))}
                  placeholder="18"
                />
              </div>
              <div>
                <Label>Place of Supply</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.placeOfSupply}
                  onChange={(e) => setForm((f) => ({ ...f, placeOfSupply: e.target.value }))}
                  placeholder="e.g. Maharashtra"
                />
              </div>
              <div className="col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Reverse Charge</Label>
                  <Badge variant={form.reverseCharge === "Yes" ? "warning" : "muted"} className="text-xs">
                    {form.reverseCharge === "Yes" ? "Applicable" : "Not Applicable"}
                  </Badge>
                </div>
                <Select value={form.reverseCharge} onValueChange={(v) => setForm((f) => ({ ...f, reverseCharge: v }))}>
                  <SelectTrigger className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center px-0">
                <FileText className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Tax Rates</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>SGST Rate (%)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  value={form.sgstRate}
                  onChange={(e) => setForm((f) => ({ ...f, sgstRate: e.target.value }))}
                  placeholder="9"
                />
              </div>
              <div>
                <Label>CGST Rate (%)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  value={form.cgstRate}
                  onChange={(e) => setForm((f) => ({ ...f, cgstRate: e.target.value }))}
                  placeholder="9"
                />
              </div>
              <div>
                <Label>IGST Rate (%)</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  value={form.igstRate}
                  onChange={(e) => setForm((f) => ({ ...f, igstRate: e.target.value }))}
                  placeholder="18"
                />
              </div>
              <div>
                <Label>TDS Rate (%) <span className="text-muted-foreground text-xs">(Optional)</span></Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="number"
                  value={form.tdsRate}
                  onChange={(e) => setForm((f) => ({ ...f, tdsRate: e.target.value }))}
                  placeholder="e.g. 1"
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
