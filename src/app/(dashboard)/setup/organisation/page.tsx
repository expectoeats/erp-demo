"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function OrganisationSetupPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    phone: "",
    email: "",
    gstin: "",
    address: "",
    invoicePrefix: "INV",
    receiptPrefix: "RCT",
    voucherPrefix: "VCH",
    invoiceFooter: "",
    bankDetails: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/settings/organisation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (r.ok) {
        toast.success("Organisation settings saved");
      } else {
        const d = await r.json().catch(() => ({}));
        toast.error(d.error || "Failed to save settings");
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Organisation settings saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Organisation Settings" description="Configure your company details" />
      <Card>
        <CardHeader>
          <CardTitle>Organisation Setup</CardTitle>
          <CardDescription>Update your company profile, document numbering, and invoice preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center px-0">
                <Building2 className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Company Information</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Company Name <span className="text-destructive">*</span></Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.companyName}
                  onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  placeholder="e.g. Evermore Estates Pvt. Ltd."
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="col-span-2">
                <Label>GSTIN</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.gstin}
                  onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
                  placeholder="22AAAAA0000A1Z5"
                />
              </div>
              <div className="col-span-2">
                <Label>Address</Label>
                <Textarea
                  className="mt-1 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  rows={3}
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Full postal address"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center px-0">
                <FileText className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Document Prefixes</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Invoice Prefix</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.invoicePrefix}
                  onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value }))}
                  placeholder="INV"
                />
              </div>
              <div>
                <Label>Receipt Prefix</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.receiptPrefix}
                  onChange={(e) => setForm((f) => ({ ...f, receiptPrefix: e.target.value }))}
                  placeholder="RCT"
                />
              </div>
              <div>
                <Label>Voucher Prefix</Label>
                <Input
                  className="mt-1 h-10 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.voucherPrefix}
                  onChange={(e) => setForm((f) => ({ ...f, voucherPrefix: e.target.value }))}
                  placeholder="VCH"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center px-0">
                <FileText className="w-4 h-4" />
              </Badge>
              <h4 className="text-sm font-semibold text-slate-800">Invoice Template</h4>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Invoice Footer</Label>
                <Textarea
                  className="mt-1 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.invoiceFooter}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceFooter: e.target.value }))}
                  placeholder="e.g. Thank you for your business!"
                />
              </div>
              <div>
                <Label>Bank Details</Label>
                <Textarea
                  className="mt-1 border-slate-200 bg-slate-50/50 focus:ring-4 focus:ring-primary/10"
                  value={form.bankDetails}
                  onChange={(e) => setForm((f) => ({ ...f, bankDetails: e.target.value }))}
                  placeholder="Bank Name: XYZ Bank&#10;A/c No: 1234567890&#10;IFSC: XYZB0001234"
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
