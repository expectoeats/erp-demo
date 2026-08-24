export interface ClientReportData {
  customerId?: string;
  name: string;
  mobile: string;
  email?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  billingType?: string;
  billingLocationName?: string;
  billingStartDate?: string;
  nextBillingDate?: string;
  services?: Array<{
    type: string;
    rate: number;
    units: number;
    calculationMode?: "reading" | "direct";
    initialReading?: number;
    currentReading?: number;
    description?: string;
  }>;
  isActive?: boolean;
  createdAt?: string;
}

export function generateClientReportPDF(data: ClientReportData) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to generate and print PDF reports.");
    return;
  }

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const fullAddress = [data.address, data.city, data.state, data.pincode]
    .filter(Boolean)
    .join(", ");

  const services = data.services || [];
  const totalServiceAmount = services.reduce((acc, curr) => {
    let units = Number(curr.units) || 0;
    if (curr.type === "electricity" && curr.calculationMode === "reading") {
      const init = Number(curr.initialReading) || 0;
      const finalVal = Number(curr.currentReading) || 0;
      units = Math.max(0, finalVal - init);
    }
    return acc + (Number(curr.rate) || 0) * units;
  }, 0);

  const servicesRowsHtml =
    services.length > 0
      ? services
          .map((s, idx) => {
            const isElec = s.type === "electricity";
            const isReading = isElec && s.calculationMode === "reading";
            let units = Number(s.units) || 0;
            if (isReading) {
              const init = Number(s.initialReading) || 0;
              const finalVal = Number(s.currentReading) || 0;
              units = Math.max(0, finalVal - init);
            }
            const rowTotal = (Number(s.rate) || 0) * units;
            const subtitle = isReading
              ? `<div style="font-size: 11px; color: #d97706; font-weight: normal;">Reading: ${s.currentReading || 0} - ${s.initialReading || 0} = ${units} kWh</div>`
              : s.description
              ? `<div style="font-size: 11px; color: #64748b; font-weight: normal;">${s.description}</div>`
              : "";

            return `
              <tr>
                <td style="text-align: center; color: #64748b; font-weight: 500;">${idx + 1}</td>
                <td style="font-weight: 600; text-transform: capitalize; color: #1e293b;">
                  ${s.type} ${subtitle}
                </td>
                <td style="text-align: right; font-family: monospace; color: #334155;">
                  ₹${Number(s.rate).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td style="text-align: center; font-family: monospace; color: #334155;">${units} ${isElec ? "kWh" : ""}</td>
                <td style="text-align: right; font-weight: 600; font-family: monospace; color: #0f172a;">
                  ₹${rowTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            `;
          })
          .join("")
      : `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8; font-style: italic;">
            No recurring services assigned to this client.
          </td>
        </tr>
      `;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Client Report - ${data.name || "Customer"}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #f8fafc;
          padding: 24px;
          line-height: 1.5;
          font-size: 13px;
        }

        .no-print-bar {
          max-width: 800px;
          margin: 0 auto 16px auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f172a;
          color: #ffffff;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .btn {
          cursor: pointer;
          border: none;
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .btn-primary {
          background: #2563eb;
          color: #ffffff;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }

        .btn-outline {
          background: transparent;
          color: #cbd5e1;
          border: 1px solid #475569;
        }
        .btn-outline:hover {
          background: #1e293b;
          color: #ffffff;
        }

        .page-container {
          max-width: 800px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.03);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 18px;
          margin-bottom: 24px;
        }

        .header-left h1 {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }

        .header-left p {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }

        .header-right {
          text-align: right;
        }

        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .badge-active {
          background: #dcfce7;
          color: #15803d;
        }

        .badge-inactive {
          background: #fee2e2;
          color: #b91c1c;
        }

        .meta-info {
          font-size: 11px;
          color: #64748b;
          margin-top: 6px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 700;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding-bottom: 6px;
          margin-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .section-title span.dot {
          width: 8px;
          height: 8px;
          background: #2563eb;
          border-radius: 50%;
          display: inline-block;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 24px;
          margin-bottom: 20px;
        }

        .info-group {
          display: flex;
          flex-direction: column;
        }

        .info-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .info-value {
          font-size: 13.5px;
          font-weight: 600;
          color: #0f172a;
          margin-top: 2px;
        }

        .info-value.mono {
          font-family: monospace;
          font-size: 13px;
          color: #334155;
        }

        .card-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 14px 16px;
          margin-bottom: 20px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          margin-bottom: 16px;
        }

        th {
          background: #f1f5f9;
          color: #475569;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 10px 12px;
          border-top: 1px solid #cbd5e1;
          border-bottom: 1px solid #cbd5e1;
        }

        td {
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 12.5px;
        }

        tr:nth-child(even) td {
          background: #fafafa;
        }

        .summary-box {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }

        .summary-card {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 6px;
          padding: 10px 18px;
          text-align: right;
          min-width: 240px;
        }

        .summary-card .label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #1e40af;
        }

        .summary-card .val {
          font-size: 18px;
          font-weight: 800;
          color: #1e3a8a;
          font-family: monospace;
          margin-top: 2px;
        }

        .footer {
          margin-top: 40px;
          padding-top: 18px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .footer-note {
          font-size: 11px;
          color: #94a3b8;
          max-width: 420px;
          line-height: 1.4;
        }

        .signature-box {
          text-align: center;
          min-width: 160px;
        }

        .sig-line {
          border-bottom: 1px dashed #94a3b8;
          height: 36px;
          margin-bottom: 6px;
        }

        .sig-label {
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        @media print {
          body {
            background: #ffffff;
            padding: 0;
          }
          .no-print-bar {
            display: none !important;
          }
          .page-container {
            border: none;
            box-shadow: none;
            padding: 0;
            max-width: 100%;
          }
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div>
          <span style="font-weight: 600; font-size: 14px;">Client Report Preview</span>
          <span style="font-size: 12px; color: #94a3b8; margin-left: 8px;">(Ready to Download / Print as PDF)</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" onclick="window.print()">
            🖨️ Print / Save as PDF
          </button>
          <button class="btn btn-outline" onclick="window.close()">
            ✕ Close
          </button>
        </div>
      </div>

      <div class="page-container">
        <!-- Header -->
        <div class="header">
          <div style="display: flex; align-items: center; gap: 16px;">
            <img src="/logo.jpeg" alt="Logo" style="height: 48px; width: 48px; border-radius: 8px; object-fit: contain;" onerror="this.style.display='none'" />
            <div class="header-left">
              <h1>Client Profile Report</h1>
              <p>Comprehensive Client Information & Billing Summary</p>
            </div>
          </div>
          <div class="header-right">
            <div>
              <span class="badge ${data.isActive !== false ? "badge-active" : "badge-inactive"}">
                ${data.isActive !== false ? "Active Client" : "Inactive Client"}
              </span>
            </div>
            <div class="meta-info">
              <div><strong>Client ID:</strong> ${data.customerId || "NEW"}</div>
              <div><strong>Generated:</strong> ${currentDate}, ${currentTime}</div>
            </div>
          </div>
        </div>

        <!-- Section 1: Basic Information -->
        <div class="section-title">
          <span class="dot"></span>
          <span>1. Client Information</span>
        </div>
        <div class="card-box">
          <div class="grid-2">
            <div class="info-group">
              <span class="info-label">Client Name</span>
              <span class="info-value" style="font-size: 15px; color: #2563eb;">${data.name || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Mobile Number</span>
              <span class="info-value">${data.mobile || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Email Address</span>
              <span class="info-value" style="font-weight: normal;">${data.email || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">GSTIN</span>
              <span class="info-value mono">${data.gstin || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">PAN</span>
              <span class="info-value mono">${data.pan || "-"}</span>
            </div>
          </div>
        </div>

        <!-- Section 2: Address Details -->
        <div class="section-title">
          <span class="dot"></span>
          <span>2. Address Details</span>
        </div>
        <div class="card-box">
          <div class="grid-2">
            <div class="info-group" style="grid-column: span 2;">
              <span class="info-label">Street Address</span>
              <span class="info-value" style="font-weight: 500;">${data.address || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">City</span>
              <span class="info-value">${data.city || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">State</span>
              <span class="info-value">${data.state || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Pincode</span>
              <span class="info-value mono">${data.pincode || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Full Address Summary</span>
              <span class="info-value" style="font-weight: 400; font-size: 12px;">${fullAddress || "-"}</span>
            </div>
          </div>
        </div>

        <!-- Section 3: Billing Preferences -->
        <div class="section-title">
          <span class="dot"></span>
          <span>3. Billing Preferences & Schedule</span>
        </div>
        <div class="card-box">
          <div class="grid-2">
            <div class="info-group">
              <span class="info-label">Billing Location</span>
              <span class="info-value">${data.billingLocationName || "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Billing Cycle / Frequency</span>
              <span class="info-value" style="text-transform: capitalize;">${data.billingType || "Monthly"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Billing Start Date</span>
              <span class="info-value">${data.billingStartDate ? new Date(data.billingStartDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</span>
            </div>
            <div class="info-group">
              <span class="info-label">Next Bill Generation Date</span>
              <span class="info-value" style="color: #2563eb;">${data.nextBillingDate ? new Date(data.nextBillingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</span>
            </div>
          </div>
        </div>

        <!-- Section 4: Assigned Services -->
        <div class="section-title">
          <span class="dot"></span>
          <span>4. Assigned Services (${services.length})</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">#</th>
              <th>Service Type</th>
              <th style="text-align: right; width: 130px;">Rate (₹)</th>
              <th style="text-align: center; width: 80px;">Units</th>
              <th style="text-align: right; width: 140px;">Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${servicesRowsHtml}
          </tbody>
        </table>

        ${
          services.length > 0
            ? `
          <div class="summary-box">
            <div class="summary-card">
              <div class="label">Total Periodic Amount</div>
              <div class="val">₹${totalServiceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        `
            : ""
        }

        <!-- Footer -->
        <div class="footer">
          <div class="footer-note">
            This is a computer-generated client profile document created via ERP System. For official records, billing verification, and accounting reference.
          </div>
          <div class="signature-box">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>
      </div>

      <script>
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.print();
          }, 300);
        });
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
