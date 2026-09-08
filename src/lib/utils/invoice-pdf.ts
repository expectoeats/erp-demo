/**
 * invoice-pdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure client-side invoice PDF generation.
 *
 * NO server PDF libraries. NO Cloudinary/S3. NO pdfUrl stored in DB.
 *
 * How it works:
 *   1. Fetch bill JSON  from /api/bills/:id
 *   2. Fetch org data   from /api/settings/organisation
 *   3. Build a fully self-contained HTML string with inline CSS
 *   4. Open a browser popup, write the HTML, call window.print()
 *   5. Browser's native "Save as PDF" / print dialog does the rest.
 *
 * Call generateInvoicePDF(billId) from any click handler.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceBillData {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  billingMonth: string;
  billingYear: number;
  status: string;
  notes?: string;
  customerId: {
    name: string;
    customerId: string;
    mobile?: string;
    email?: string;
    address?: string;
    gstin?: string;
  };
  unitId?: { unitCode: string; unitId: string; area?: number; areaUnit?: string };
  locationId?: { name: string; address?: string; gstin?: string };
  billTypeId?: { name: string; prefix: string };
  financialYearId?: { name: string };
  items: Array<{
    serviceName: string;
    serviceCode?: string;
    calculationType?: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
    isTaxable: boolean;
    gstRate: number;
    gstAmount: number;
    totalAmount: number;
    notes?: string;
  }>;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  totalGst: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
}

export interface OrgData {
  companyName: string;
  orgCode?: string;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankDetails?: string;
  invoiceFooter?: string;
  isDefault?: boolean;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function inr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function statusPill(status: string): string {
  const colors: Record<string, [string, string]> = {
    paid:           ["#059669", "#d1fae5"],
    unpaid:         ["#d97706", "#fef3c7"],
    partially_paid: ["#2563eb", "#dbeafe"],
    overdue:        ["#dc2626", "#fee2e2"],
    cancelled:      ["#6b7280", "#f1f5f9"],
  };
  const [fg, bg] = colors[status] ?? ["#334155", "#f8fafc"];
  return `<span style="display:inline-block;padding:3px 12px;border-radius:6px;font-size:10.5px;
    font-weight:700;text-transform:uppercase;letter-spacing:.06em;
    background:${bg};color:${fg};border:1px solid ${fg}33;">
    ${status.replace("_", " ")}</span>`;
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHTML(bill: InvoiceBillData, org: OrgData): string {
  /* ── Shared inline style constants (declared first) ── */
  const TD = "padding:9px 12px;vertical-align:top;border-bottom:1px solid #f1f5f9;font-size:11.5px;";
  const TH = "padding:8px 10px;text-align:right;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;";

  /* ── GST slab computation ────────────────────────────── */
  const sameState =
    bill.locationId?.gstin && bill.customerId?.gstin
      ? bill.locationId.gstin.slice(0, 2) === bill.customerId.gstin.slice(0, 2)
      : true;

  type Slab = { taxable: number; cgst: number; sgst: number; igst: number; total: number };
  const slabMap = new Map<string, Slab>();
  let totalBase = 0, totalGstCalc = 0, exemptBase = 0;

  for (const it of bill.items ?? []) {
    const amt = Number(it.amount) || 0;
    if (!it.isTaxable) { exemptBase += amt; continue; }
    totalBase += amt;
    const g = Number(it.gstAmount) || 0;
    totalGstCalc += g;
    const k = String(it.gstRate ?? 0);
    const b = slabMap.get(k) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    b.taxable += amt; b.total += g;
    if (sameState) { b.cgst += g / 2; b.sgst += g / 2; } else { b.igst += g; }
    slabMap.set(k, b);
  }
  const slabs = [...slabMap.entries()].sort((a, b) => +a[0] - +b[0]);

  /* ── Org address ─────────────────────────────────────── */
  const orgAddr = [org.address, org.city, org.state, org.pincode].filter(Boolean).join(", ");

  /* ── Logo block ──────────────────────────────────────── */
  const logoBlock = org.logo
    ? `<img src="${org.logo}" alt="logo" style="height:52px;width:52px;object-fit:contain;
        border-radius:8px;border:1px solid #e2e8f0;"/>`
    : `<div style="height:52px;width:52px;border-radius:8px;background:#eff6ff;
        border:1px solid #bfdbfe;display:flex;align-items:center;justify-content:center;
        font-weight:900;font-size:22px;color:#3b82f6;">
        ${(org.companyName ?? "?").charAt(0).toUpperCase()}</div>`;

  /* ── Line item rows ──────────────────────────────────── */
  const itemRows = (bill.items ?? []).map((it, i) => {
    const r = Number(it.gstRate) || 0;
    const taxTag = it.isTaxable && r > 0
      ? `<span style="font-size:9.5px;background:#d1fae5;color:#065f46;border:1px solid
          #a7f3d0;border-radius:4px;padding:1px 5px;font-weight:700;margin-top:2px;
          display:inline-block;">GST ${r}%</span>`
      : `<span style="font-size:9.5px;background:#f8fafc;color:#64748b;border:1px solid
          #e2e8f0;border-radius:4px;padding:1px 5px;font-weight:700;margin-top:2px;
          display:inline-block;">Exempt</span>`;
    return `<tr>
      <td style="${TD}text-align:center;color:#94a3b8;font-weight:700;">${i + 1}</td>
      <td style="${TD}">
        <div style="font-weight:700;color:#0f172a;">${it.serviceName}</div>
        ${it.notes ? `<div style="font-size:10px;color:#64748b;margin-top:1px;">${it.notes}</div>` : ""}
        ${taxTag}
      </td>
      <td style="${TD}text-align:right;font-family:monospace;color:#475569;">${inr(Number(it.rate))}/${it.unit}</td>
      <td style="${TD}text-align:right;font-family:monospace;color:#475569;">${it.quantity} <span style="font-size:9px;color:#94a3b8;">${it.unit}</span></td>
      <td style="${TD}text-align:right;font-family:monospace;font-weight:600;color:#1e293b;">${inr(Number(it.amount))}</td>
      <td style="${TD}text-align:center;">
        ${it.isTaxable && r > 0
          ? `<span style="font-family:monospace;font-weight:700;font-size:11px;
              background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;
              border-radius:4px;padding:2px 5px;">${r}%</span>`
          : `<span style="color:#94a3b8;font-family:monospace;font-weight:700;">0%</span>`}
      </td>
      <td style="${TD}text-align:right;font-family:monospace;font-weight:700;
          color:${it.isTaxable && r > 0 ? "#059669" : "#94a3b8"};">
        ${it.isTaxable && r > 0 ? inr(Number(it.gstAmount)) : "₹0.00"}
      </td>
      <td style="${TD}text-align:right;font-family:monospace;font-weight:900;
          color:#0f172a;font-size:12.5px;">${inr(Number(it.totalAmount))}</td>
    </tr>`;
  }).join("");

  /* ── GST summary rows ────────────────────────────────── */
  const gstRows = slabs.map(([rate, b]) => `
    <tr style="font-size:11px;">
      <td style="padding:5px 10px;color:#475569;">GST @ ${rate}%</td>
      <td style="padding:5px 10px;text-align:right;font-family:monospace;">${inr(b.taxable)}</td>
      ${sameState
        ? `<td style="padding:5px 10px;text-align:right;font-family:monospace;">${inr(b.cgst)}</td>
           <td style="padding:5px 10px;text-align:right;font-family:monospace;">${inr(b.sgst)}</td>`
        : `<td style="padding:5px 10px;text-align:right;font-family:monospace;" colspan="2">${inr(b.igst)}</td>`}
      <td style="padding:5px 10px;text-align:right;font-family:monospace;font-weight:700;color:#059669;">${inr(b.total)}</td>
    </tr>`).join("");

  const gstColHeaders = sameState
    ? `<th style="${TH}">CGST</th><th style="${TH}">SGST</th>`
    : `<th style="${TH}" colspan="2">IGST</th>`;

  /* ── Bank details ────────────────────────────────────── */
  const bankBlock = org.bankDetails

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/><title>Invoice ${bill.invoiceNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:-apple-system,"Segoe UI",Arial,sans-serif;color:#1e293b;background:#fff;font-size:12px;}
  table{border-collapse:collapse;width:100%;}
  @page{size:A4;margin:14mm 12mm;}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .no-print{display:none!important;}
  }
</style></head><body>
<div style="max-width:860px;margin:0 auto;padding:24px 20px 32px;">

  <!-- PRINT BUTTON (hidden on print) -->
  <div class="no-print" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;">
    <button onclick="window.print()" style="padding:8px 20px;background:#1e293b;color:#fff;
      border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">
      🖨️ Print / Save as PDF
    </button>
    <button onclick="window.close()" style="padding:8px 16px;background:#f1f5f9;
      border:1px solid #e2e8f0;border-radius:6px;font-size:13px;cursor:pointer;">
      Close
    </button>
  </div>

  <!-- HEADER -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;
    border-bottom:2.5px solid #3b82f6;padding-bottom:18px;margin-bottom:18px;">
    <div style="display:flex;align-items:center;gap:14px;">
      ${logoBlock}
      <div>
        <div style="font-size:19px;font-weight:900;color:#0f172a;letter-spacing:-.3px;">
          ${org.companyName}</div>
        ${org.orgCode ? `<div style="font-size:10px;font-family:monospace;color:#64748b;margin-top:1px;">${org.orgCode}</div>` : ""}
        ${orgAddr ? `<div style="font-size:10.5px;color:#64748b;margin-top:3px;">${orgAddr}</div>` : ""}
        ${org.gstin ? `<div style="font-family:monospace;font-size:10.5px;color:#475569;margin-top:1px;font-weight:600;">GSTIN: ${org.gstin}</div>` : ""}
        ${org.phone ? `<div style="font-size:10.5px;color:#64748b;margin-top:1px;">Ph: ${org.phone}${org.email ? " · " + org.email : ""}</div>` : ""}
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:21px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#0f172a;">
        Tax Invoice</div>
      <div style="margin-top:6px;">${statusPill(bill.status)}</div>
    </div>
  </div>

  <!-- META GRID -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
    padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;
    border-radius:8px;margin-bottom:18px;">
    ${[
      ["Invoice Number", `<span style="font-family:monospace;font-weight:800;font-size:13px;color:#0f172a;">${bill.invoiceNumber}</span>`],
      ["Invoice Date",   fmtDate(bill.invoiceDate)],
      ["Due Date",       fmtDate(bill.dueDate)],
      ["Billing Period", `${bill.billingMonth} ${bill.billingYear}`],
    ].map(([label, val]) => `
      <div>
        <div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;
          color:#94a3b8;font-weight:700;margin-bottom:3px;">${label}</div>
        <div style="font-weight:600;color:#1e293b;">${val}</div>
      </div>`).join("")}
  </div>

  <!-- BILL-TO + PROPERTY -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
    <div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
        color:#64748b;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:8px;">Billed To</div>
      <div style="font-size:14px;font-weight:800;color:#0f172a;margin-bottom:3px;">${bill.customerId?.name ?? "-"}</div>
      <div style="font-family:monospace;font-size:11px;color:#64748b;margin-bottom:2px;">ID: ${bill.customerId?.customerId ?? "-"}</div>
      ${bill.customerId?.mobile ? `<div style="font-size:11px;color:#64748b;">Mobile: ${bill.customerId.mobile}</div>` : ""}
      ${bill.customerId?.email  ? `<div style="font-size:11px;color:#64748b;">${bill.customerId.email}</div>` : ""}
      ${bill.customerId?.gstin  ? `<div style="font-family:monospace;font-size:11px;font-weight:600;color:#475569;margin-top:3px;">GSTIN: ${bill.customerId.gstin}</div>` : ""}
      ${bill.customerId?.address ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:3px;">${bill.customerId.address}</div>` : ""}
    </div>
    <div style="padding:14px;border:1px solid #e2e8f0;border-radius:8px;">
      <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
        color:#64748b;border-bottom:1px solid #f1f5f9;padding-bottom:6px;margin-bottom:8px;">Property / Billing Info</div>
      ${bill.locationId ? `<div style="font-size:12.5px;font-weight:700;color:#0f172a;margin-bottom:2px;">${bill.locationId.name}</div>${bill.locationId.gstin ? `<div style="font-family:monospace;font-size:11px;color:#475569;margin-bottom:3px;">GSTIN: ${bill.locationId.gstin}</div>` : ""}` : ""}
      ${bill.unitId ? `<div style="font-size:11px;color:#475569;margin-bottom:2px;"><span style="color:#94a3b8;">Unit:</span> <strong>${bill.unitId.unitCode}</strong> (${bill.unitId.unitId})</div>` : ""}
      ${bill.billTypeId ? `<div style="font-size:11px;color:#475569;margin-bottom:2px;"><span style="color:#94a3b8;">Bill Type:</span> ${bill.billTypeId.name}</div>` : ""}
      ${bill.financialYearId ? `<div style="font-size:11px;color:#475569;"><span style="color:#94a3b8;">Financial Year:</span> ${bill.financialYearId.name}</div>` : ""}
    </div>
  </div>

  <!-- LINE ITEMS TABLE -->
  <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <table style="table-layout:fixed;">
      <colgroup>
        <col style="width:30px;"/><col style="width:auto;"/><col style="width:88px;"/>
        <col style="width:70px;"/><col style="width:96px;"/><col style="width:54px;"/>
        <col style="width:82px;"/><col style="width:100px;"/>
      </colgroup>
      <thead>
        <tr style="background:#1e293b;color:#f8fafc;">
          ${["#","Service Description","Rate","Qty","Taxable","GST%","GST Amt","Total"]
            .map((h,i) => `<th style="padding:10px ${i===1?12:i===0?8:12}px;text-align:${i<2?"left":"right"};font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${h}</th>`)
            .join("")}
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr style="background:#f8fafc;border-top:2px solid #e2e8f0;">
          <td colspan="4" style="padding:10px 12px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;">Total →</td>
          <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:800;color:#0f172a;">${inr(totalBase + exemptBase)}</td>
          <td></td>
          <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:800;color:#059669;">${inr(totalGstCalc)}</td>
          <td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:900;color:#0f172a;font-size:13px;">${inr(totalBase + exemptBase + totalGstCalc)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- GST SUMMARY + TOTALS BOX -->
  <div style="display:grid;grid-template-columns:1fr 280px;gap:20px;margin-bottom:24px;align-items:start;">
    <div>
      ${slabs.length > 0 ? `
      <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:12px;">
        <div style="padding:7px 10px;background:#f8fafc;border-bottom:1px solid #e2e8f0;
          font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#475569;">
          GST Summary — ${sameState ? "Intra-State (CGST + SGST)" : "Inter-State (IGST)"}</div>
        <table>
          <thead><tr>
            <th style="${TH}text-align:left;">GST Slab</th>
            <th style="${TH}">Taxable Value</th>
            ${gstColHeaders}
            <th style="${TH}">Total GST</th>
          </tr></thead>
          <tbody>${gstRows}</tbody>
          <tfoot><tr style="background:#f0fdf4;border-top:1px solid #d1fae5;">
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:#065f46;">Total</td>
            <td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:700;color:#065f46;">${inr(totalBase)}</td>
            ${sameState
              ? `<td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:700;color:#065f46;">${inr(totalGstCalc/2)}</td>
                 <td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:700;color:#065f46;">${inr(totalGstCalc/2)}</td>`
              : `<td colspan="2" style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:700;color:#065f46;">${inr(totalGstCalc)}</td>`}
            <td style="padding:7px 10px;text-align:right;font-family:monospace;font-weight:900;color:#059669;font-size:12px;">${inr(totalGstCalc)}</td>
          </tr></tfoot>
        </table>
      </div>` : ""}
      ${bill.notes ? `<div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;color:#475569;margin-bottom:10px;"><strong style="color:#334155;">Notes / Terms:</strong><br/>${bill.notes}</div>` : ""}
      ${bankBlock}
    </div>

    <!-- TOTALS BOX -->
    <div style="border:2px solid #334155;border-radius:10px;overflow:hidden;">
      <div style="background:#1e293b;padding:8px 14px;display:flex;align-items:center;gap:6px;">
        <div style="width:7px;height:7px;border-radius:50%;background:#fbbf24;"></div>
        <span style="font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:800;color:#f8fafc;">Invoice Summary (₹)</span>
      </div>
      <div style="padding:12px 14px;background:#fff;">
        ${[
          ["Subtotal", inr(bill.subtotal), "#1e293b", ""],
          ...(bill.discount > 0 ? [["(-) Discount", `– ${inr(bill.discount)}`, "#059669", ""]] : []),
        ].map(([l,v,c]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11.5px;"><span style="color:#64748b;">${l}</span><span style="font-family:monospace;font-weight:600;color:${c};">${v}</span></div>`).join("")}
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px dashed #e2e8f0;margin-top:4px;font-size:11.5px;">
          <span style="font-weight:700;color:#334155;">Taxable Amount</span>
          <span style="font-family:monospace;font-weight:800;color:#0f172a;">${inr(bill.taxableAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 10px;background:#f0fdf4;border:1px solid #a7f3d0;border-radius:6px;margin:4px 0;font-size:11.5px;">
          <span style="font-weight:800;text-transform:uppercase;letter-spacing:.06em;font-size:10px;color:#065f46;">GST</span>
          <span style="font-family:monospace;font-weight:900;color:#059669;font-size:13px;">${inr(bill.totalGst || totalGstCalc)}</span>
        </div>
        ${bill.otherCharges > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11.5px;"><span style="color:#64748b;">Other Charges</span><span style="font-family:monospace;font-weight:600;">${inr(bill.otherCharges)}</span></div>` : ""}
        ${bill.roundOff !== 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10.5px;color:#94a3b8;"><span>Round Off</span><span style="font-family:monospace;">${inr(bill.roundOff)}</span></div>` : ""}
        <div style="height:1px;background:#e2e8f0;margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#0f172a;border-radius:7px;color:#f8fafc;margin-bottom:10px;">
          <span style="font-weight:900;text-transform:uppercase;letter-spacing:.08em;font-size:10px;">Grand Total</span>
          <span style="font-family:monospace;font-weight:900;font-size:15px;">${inr(bill.grandTotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;"><span style="color:#64748b;">Amount Received:</span><span style="font-family:monospace;font-weight:700;color:#059669;">${inr(bill.paidAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;"><span style="color:#64748b;">Balance Due:</span><span style="font-family:monospace;font-weight:800;color:${bill.status==="paid"||bill.outstandingAmount<=0?"#059669":"#dc2626"};">${inr(bill.status==="paid"?0:bill.outstandingAmount)}</span></div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px;">
    <div style="max-width:400px;">
      <p style="font-weight:700;color:#334155;font-size:11.5px;margin-bottom:4px;">Thank you for your business.</p>
      <p style="font-size:10px;color:#94a3b8;line-height:1.5;">This is a computer-generated tax invoice under the Goods &amp; Services Tax (GST) Act, 2017. Does not require a physical signature.</p>
      ${org.invoiceFooter ? `<p style="font-size:10px;color:#64748b;margin-top:6px;font-style:italic;">${org.invoiceFooter}</p>` : ""}
    </div>
    <div style="display:flex;gap:28px;align-items:flex-end;">
      <div style="text-align:center;width:110px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:3px;">Seal &amp; Stamp</div>
        <div style="border:2px dashed #cbd5e1;height:50px;border-radius:4px;background:#f8fafc;"></div>
      </div>
      <div style="text-align:center;width:130px;">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;margin-bottom:3px;">Authorised Signatory</div>
        <div style="border-bottom:2px dashed #94a3b8;height:50px;margin-bottom:4px;"></div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#475569;">Signature &amp; Name</div>
      </div>
    </div>
  </div>

</div>
</body></html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates and opens an invoice PDF popup for the given bill.
 *
 * @param billIdOrData  MongoDB _id string OR a pre-loaded InvoiceBillData object
 * @param onError       Optional toast/alert callback; defaults to alert()
 */
export async function generateInvoicePDF(
  billIdOrData: string | InvoiceBillData,
  onError?: (msg: string) => void,
): Promise<void> {
  const notify = onError ?? ((m: string) => alert(m));

  // Open popup IMMEDIATELY inside the click handler (before any async)
  // — browsers block popups opened from async/microtask context.
  const popup = window.open("", "_blank");
  if (!popup) {
    notify("Please allow popups for this site to generate the invoice PDF.");
    return;
  }

  // Loading placeholder while fetching data
  popup.document.write(`<!DOCTYPE html><html><head><title>Loading…</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
    height:100vh;background:#f8fafc;color:#64748b;gap:12px;font-size:14px;}
    .s{width:22px;height:22px;border:3px solid #e2e8f0;border-top-color:#3b82f6;
    border-radius:50%;animation:s .7s linear infinite;}
    @keyframes s{to{transform:rotate(360deg);}}</style></head>
    <body><div class="s"></div><span>Preparing invoice…</span></body></html>`);

  try {
    // 1. Fetch bill
    let bill: InvoiceBillData;
    if (typeof billIdOrData === "string") {
      const r = await fetch(`/api/bills/${billIdOrData}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed to load bill");
      bill = j.data as InvoiceBillData;
    } else {
      bill = billIdOrData;
    }

    // 2. Fetch org settings (non-fatal fallback)
    let org: OrgData = { companyName: "Your Company" };
    try {
      const r = await fetch("/api/settings/organisation");
      if (r.ok) {
        const j = await r.json();
        const list: OrgData[] = j.data ?? [];
        org = list.find((o) => o.isDefault) ?? list[0] ?? org;
      }
    } catch { /* use fallback */ }

    // 3. Build HTML and replace popup content
    const html = buildHTML(bill, org);
    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    // 4. Auto-print once loaded
    popup.addEventListener("load", () => {
      setTimeout(() => { popup.focus(); popup.print(); }, 400);
    });
  } catch (e) {
    popup.close();
    notify(e instanceof Error ? e.message : "Failed to generate invoice PDF");
  }
}
