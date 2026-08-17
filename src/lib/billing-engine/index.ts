import type { CalculationType } from "@/lib/models/Service";

export interface BillServiceInput {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  calculationType: CalculationType;
  quantity: number;
  unit: string;
  rate: number;
  manualAmount?: number;
  isTaxable: boolean;
  gstRate: number;
  notes?: string;
}

export interface BillItem {
  serviceId: string;
  serviceName: string;
  serviceCode: string;
  calculationType: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  isTaxable: boolean;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  notes?: string;
}

export interface BillingInput {
  services: BillServiceInput[];
  discount?: number;
  otherCharges?: number;
  applyRoundOff?: boolean;
}

export interface BillingOutput {
  items: BillItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  totalGst: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * Core billing engine — all calculations happen here.
 * Never duplicated in UI or other services.
 */
export function calculateBill(input: BillingInput): BillingOutput {
  const items: BillItem[] = input.services.map((svc) => {
    let amount = 0;

    switch (svc.calculationType) {
      case "AREA_RATE":
      case "QUANTITY_RATE":
        // quantity × rate
        amount = svc.quantity * svc.rate;
        break;
      case "FIXED":
        amount = svc.rate;
        break;
      case "MANUAL":
        // operator enters the amount directly (stored as manualAmount, quantity=1, rate=amount)
        amount = svc.manualAmount ?? svc.quantity * svc.rate;
        break;
      case "METER":
        // consumption × rate
        amount = svc.quantity * svc.rate;
        break;
      default:
        amount = svc.quantity * svc.rate;
    }

    const gstAmount = svc.isTaxable ? parseFloat(((amount * svc.gstRate) / 100).toFixed(2)) : 0;
    const totalAmount = parseFloat((amount + gstAmount).toFixed(2));

    return {
      serviceId: svc.serviceId,
      serviceName: svc.serviceName,
      serviceCode: svc.serviceCode,
      calculationType: svc.calculationType,
      quantity: svc.quantity,
      unit: svc.unit,
      rate: svc.rate,
      amount: parseFloat(amount.toFixed(2)),
      isTaxable: svc.isTaxable,
      gstRate: svc.gstRate,
      gstAmount,
      totalAmount,
      notes: svc.notes,
    };
  });

  const subtotal = parseFloat(items.reduce((s, i) => s + i.amount, 0).toFixed(2));
  const discount = parseFloat((input.discount ?? 0).toFixed(2));
  const taxableAmount = parseFloat((subtotal - discount).toFixed(2));
  const totalGst = parseFloat(items.reduce((s, i) => s + i.gstAmount, 0).toFixed(2));
  const otherCharges = parseFloat((input.otherCharges ?? 0).toFixed(2));

  const rawGrandTotal = taxableAmount + totalGst + otherCharges;
  const roundOff = input.applyRoundOff
    ? parseFloat((Math.round(rawGrandTotal) - rawGrandTotal).toFixed(2))
    : 0;
  const grandTotal = parseFloat((rawGrandTotal + roundOff).toFixed(2));

  return { items, subtotal, discount, taxableAmount, totalGst, otherCharges, roundOff, grandTotal };
}
