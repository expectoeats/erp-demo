# ERP Performance, GST & Meter Reading Fixes - Implementation Plan

## Task 1: Audit & Fix Data Loading Performance (All Pages)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Audit every client page that performs `fetch()` for missing AbortController, missing `r.ok` guards, and missing fallbacks before `.json()`.
  - Dashboard widgets (`dashboard-stats.tsx`, `recent-bills.tsx`, `recent-payments.tsx`): add AbortController, mounted guard, silent fallback `catch`, remove toast spam on initial load.
  - Masters list pages (`new-bills/page.tsx`, `bills/page.tsx`, `customers/page.tsx`, `services/page.tsx`, `units/page.tsx`, `meters/page.tsx`, `rate-list/page.tsx`, `rate-lists/page.tsx`, `sub-locations/page.tsx`, `financial-years/page.tsx`): ensure consistent abort controller + debounce + silent fallback.
  - Reports pages same treatment.
  - Parallelize initial loads with `Promise.all` where they are currently sequential.
  - Ensure `setLoading(true)` does not flicker unnecessarily on filter/pagination transitions when we can show stale data briefly.
- **Acceptance Criteria Addressed**: AC-1, AC-2
- **Test Requirements**:
  - `rule` TR-1.1: Every `fetch()` call in client components either uses AbortController/signal OR is a one-shot user-initiated action (POST/PATCH save buttons). Evidence: grep `fetch(` results reviewed; all GET calls site-wide have a signal or equivalent.
  - `rule` TR-1.2: No page shows a toast.error on initial mount / navigation due to failed API response. Evidence: manually click through Dashboard → New Bills → Bill List → Generate Bill → Dashboard rapidly and confirm zero toasts.
  - `rubric` TR-1.3: Perceived smoothness of load transitions across all major pages; scale 1-5; anchors 1=janky/blanks; 3=acceptable; 5=instant skeletons + parallel fetches + no layout jitter; threshold >=4; evidence=visual walkthrough.
- **Notes**: Touch files under `src/app/(dashboard)/**/page.tsx` and `src/components/dashboard/**/*.tsx` only.

## Task 2: Eliminate "Failed to Client" Error Root Cause
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Identify pages that call `.json()` unconditionally on a non-OK response and wrap them.
  - Identify pages that `toast.error` in `catch` during component mount `useEffect`; silence non-AbortError network errors on initial load.
  - In all pages, ensure `AbortError` (signal) is explicitly swallowed.
  - Audit `bills/[id]/page.tsx`, `generate-bill/page.tsx`, `customers/page.tsx`, `services/page.tsx`, `new-bills/page.tsx`, `units/page.tsx`, `rate-list/page.tsx`, `dashboard-stats.tsx`, `recent-bills.tsx`, `recent-payments.tsx`.
  - Ensure every toast.error only fires on explicit user action (button click, submit) and not during navigation/auto-load.
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-2.1: Grep for `toast.error` inside `useEffect` mount-style blocks returns 0 hits (or hits are behind explicit user interaction). Evidence: grep results reviewed.
  - `rule` TR-2.2: Every network error path has an `if (e instanceof DOMException && e.name === 'AbortError') return;` guard OR an equivalent try/catch with silent fallback. Evidence: code review of each modified file.
  - `rule` TR-2.3: Navigation stress test (10 rapid sidebar clicks) yields zero toasts and zero uncaught console errors. Evidence: manual stress test.

## Task 3: GST Dialog — Service Master Dialog Polish & GST Chips
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Enhance `src/app/(dashboard)/masters/services/page.tsx` create/edit dialog:
    - Sectioned layout: Service basics block, Calculation block, Taxation block (badge + divider).
    - Keep existing taxable switch; add a better icon badge header (Zap or calculator style icon) for the Taxation section.
    - Keep the GST input; verify min/max/step enforced.
    - Keep chips 0/5/12/18/28 with primary-selected style.
    - Live example preview line with correct ₹1000 × GST% math.
  - Ensure list table column `GST %` renders the badge correctly.
  - Harden `handleSave` to force `gstRate=0` when `isTaxable=false` before sending to API.
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `rule` TR-3.1: Creating a service with isTaxable=true and gstRate=18 persists correctly; editing to 5 persists correctly; toggling isTaxable=false zeroes gstRate on save. Evidence: network tab + table view.
  - `rubric` TR-3.2: Taxation section visual polish in dialog; scale 1-5; anchors 1=plain ugly; 3=ok; 5=icon-badge section header, divider, chips with selected-state polish, live example; threshold >=4; evidence=screenshot of dialog.

## Task 4: Generate Bill — Per-Line GST Override & Variable Tax Recalculation
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - In `src/app/(dashboard)/transactions/generate-bill/page.tsx`:
    - Audit that `ServiceLine` inherits `isTaxable` and `gstRate` from the service master (already present; validate).
    - Ensure the per-line GST box renders the 0/5/18 quick chips (or 0/5/12/18/28 if space allows) and live preview.
    - Add quick chips: "0% Water", "5%", "12%", "18%", "28%" buttons with selected state.
    - Ensure changing gstRate/isTaxable on any line instantly triggers `calculateBill()` re-render of preview.
    - Ensure 0% GST (water bill) produces gstAmount=0 AND linePreview/total correctly equals amount.
    - Ensure discount+roundOff+otherCharges flows through aggregated totals correctly.
  - Verify that the preview sidebar card shows per-line GST % pill, line GST amount, aggregate totalGst row.
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-4.1: Test case 3 lines (Rent 18%, Elec 18%, Water 0%); change Rent to 12%, add discount ₹100; compare preview with hand calculation. Evidence: screenshot + math.
  - `rule` TR-4.2: 0% GST line (e.g. Water) produces gstAmount=0 and totalAmount=amount exactly. Evidence: preview panel.
  - `rule` TR-4.3: Final saved bill (via POST `/api/bills`) payload contains exact gstRate, gstAmount, totalGst as preview. Evidence: network tab payload vs saved bill detail page.

## Task 5: Invoice Print Template GST Columnar Alignment
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 4
- **Description**:
  - Audit `src/app/(dashboard)/transactions/bills/[id]/page.tsx`:
    - Keep existing `colgroup` widths; tighten if any column bleed observed.
    - Ensure header order # | Service Description | Rate | Qty | Taxable | GST | Total exactly matches data cells.
    - Verify right-align, `tabular-nums font-mono whitespace-nowrap align-top` on every numeric column.
    - GST cell: stacked `{gstRate}%` (bold) on top line and `{gstAmount}` (emerald mono) below; 0% lines show "—" consistently.
    - Below-item service-note lines (meter reading, GST note) wrap naturally without breaking alignment.
  - Totals block: verify Subtotal → Discount → Taxable → GST (emerald bg highlight) → Other Charges → RoundOff → Grand Total (dark badge white text).
  - Add global `@media print` CSS into `globals.css` if missing to force `@page { margin: 12mm; }`, `.no-print { display: none !important; }` already exists, ensure table widths preserved.
  - Ensure print break points: the itemized table and summary block use `break-inside-avoid` where appropriate.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rubric` TR-5.1: Print preview visual alignment; scale 1-5; anchors 1=misaligned columns; 3=usable; 5=perfectly locked colgroup widths, stacked GST cell, mono numerals aligned right on every row with no bleed; threshold >=4; evidence=PDF print preview screenshot.
  - `rule` TR-5.2: The GST summary row in totals block renders emerald highlight when totalGst > 0 exactly and shows ₹0 text correctly otherwise. Evidence: bill detail page screenshot.
  - `rule` TR-5.3: Print mode hides top action bar, back button, and any interactive elements (no-print). Evidence: print preview.

## Task 6: Meter Reading Capture Dialog — UX Polish & Validation Hardening
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Enhance `generate-bill/page.tsx` meter modal:
    - Icon-badge header block + sectioned inputs (start / end / consumption preview).
    - Show the last reading hint if parseable from previous bill month `notes` for same unit+service (optional, basic).
    - Validate: Start and End required numeric; End >= Start; warn if consumption 0 (allow but show soft badge).
    - Confirm button: confirm text `Confirm & Apply {consumption} units` with live value.
  - METER line card: amber highlighted, show the capture button with ZAP-style appropriate lucide icon (v1.31.0 compatible).
  - Reading notes formatted as `Meter: {start} → {end} = {consumption} {unit}`.
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `rule` TR-6.1: Happy path: Start=1200 End=1350 → consumption=150; quantity set; notes written. Evidence: line card shows values.
  - `rule` TR-6.2: Validation path: Start=100 End=50 → toast error "End reading cannot be less than Start reading"; modal stays open. Evidence: toast screenshot.
  - `rubric` TR-6.3: Meter modal UX polish; scale 1-5; anchors 1=plain prompt; 3=ok; 5=sectioned with icons, live consumption preview, dynamic button text, validation styling; threshold >=4; evidence=modal screenshot.

## Task 7: Historical Immutability Hardening & API Contracts
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Audit `/api/bills/route.ts` POST:
    - Ensure the pre-create duplicate Bill.findOne check and unique compound index both cover paths (done already; ensure 409 message mentions immutability explicitly).
    - Make conflict message user-friendly: "A bill already exists for {unit} in {billingMonth} {billingYear}. Past bills are immutable — please generate a bill for a new period."
  - Audit `/api/bills/[id]/route.ts` PATCH:
    - Widen the sanitized allow-list inspection so attempts to modify items/amounts explicitly return 403 with message "Cannot modify a generated bill's line items or totals. Only status/payment/cancellation updates are allowed.".
    - Make sure that if body contains `cancellationReason` without setting `status="cancelled"`, still accept it only when also cancelling.
  - Ensure Bill model compound index is kept (already present), and add/verify a comment near it.
  - Generate Bill page UI: surface the 409 message as a toast instead of generic "Failed to generate bill".
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TR-7.1: Duplicate POST for same unit+month+year returns HTTP 409 with user-friendly immutability message. Evidence: DevTools response body.
  - `rule` TR-7.2: PATCH /api/bills/:id with { items: [], subtotal: 0 } returns HTTP 403 with explicit immutable-block message and document unchanged. Evidence: response + DB read-back.
  - `rule` TR-7.3: Generate bill page UI toast shows the returned 409 immutability message word-for-word. Evidence: toast screenshot.

## Task 8: Type / Lint Pass & Build
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 1-7
- **Description**:
  - Run `npm run build` and fix any TypeScript / ESLint errors introduced.
  - Ensure `getDiagnostics` VS Code check passes (no red squiggles on modified files).
  - Smoke test end-to-end: login → services create → generate bill → view bill → print preview.
- **Acceptance Criteria Addressed**: AC-1 through AC-7 (integration)
- **Test Requirements**:
  - `rule` TR-8.1: `npm run build` exits 0. Evidence: terminal output.
  - `rule` TR-8.2: GetDiagnostics clean for modified source files. Evidence: diagnostics result.
  - `rubric` TR-8.3: End-to-end user flow coherence; scale 1-5; anchors 1=broken; 3=works; 5=silky smooth, zero friction, every toast is informative and correctly timed; threshold >=4; evidence=walkthrough.
