import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Customer from "@/lib/models/Customer";
import OrgSettings from "@/lib/models/OrgSettings";
import Location from "@/lib/models/Location";
import SubLocation from "@/lib/models/SubLocation";
import Bill from "@/lib/models/Bill";
import BillType from "@/lib/models/BillType";
import FinancialYear from "@/lib/models/FinancialYear";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const serviceItemSchema = z.object({
  type: z.string().min(1),
  rate: z.number().default(0),
  units: z.number().default(1),
  calculationMode: z.enum(["reading", "direct"]).optional(),
  initialReading: z.number().optional(),
  currentReading: z.number().optional(),
  description: z.string().optional(),
});

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(10, "Valid mobile required"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  orgId: z.string().optional().or(z.literal("")),
  billingLocationId: z.string().optional().or(z.literal("")),
  billingType: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  billingStartDate: z.string().optional().or(z.literal("")),
  services: z.array(serviceItemSchema).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

function calculateNextBillingDate(startDate: Date, frequency: string = "monthly"): Date {
  const d = new Date(startDate);
  if (frequency === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (frequency === "yearly") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const query = search
    ? {
        $or: [
          { name: new RegExp(search, "i") },
          { mobile: new RegExp(search, "i") },
          { customerId: new RegExp(search, "i") },
          { email: new RegExp(search, "i") },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    Customer.find(query)
      .populate("orgId", "companyName orgCode locationId")
      .populate("billingLocationId", "name locationId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(query),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const seq = await getNextSequence("customer");
  const customerId = `CUST-${String(seq).padStart(5, "0")}`;

  const startDate = parsed.data.billingStartDate
    ? new Date(parsed.data.billingStartDate)
    : new Date();

  const billingType = parsed.data.billingType || "monthly";
  const nextBillingDate = calculateNextBillingDate(startDate, billingType);

  const customerPayload = {
    ...parsed.data,
    orgId: parsed.data.orgId ? parsed.data.orgId : undefined,
    billingLocationId: parsed.data.billingLocationId ? parsed.data.billingLocationId : undefined,
    billingStartDate: startDate,
    billingType,
    nextBillingDate,
    customerId,
    createdBy: session!.user.id,
  };

  const customer = await Customer.create(customerPayload);

  // If customer has services assigned, auto-generate their first bill (unpaid)
  if (parsed.data.services && parsed.data.services.length > 0) {
    try {
      let billType = await BillType.findOne({ isActive: true });
      if (!billType) {
        billType = await BillType.create({
          name: "Standard Invoice",
          code: "INV",
          prefix: "INV",
          createdBy: session!.user.id,
        });
      }

      let fy = await FinancialYear.findOne({ isActive: true });
      if (!fy) {
        const currentYear = new Date().getFullYear();
        fy = await FinancialYear.create({
          name: `${currentYear}-${String(currentYear + 1).slice(-2)}`,
          startDate: new Date(currentYear, 3, 1),
          endDate: new Date(currentYear + 1, 2, 31),
          isActive: true,
          isClosed: false,
          createdBy: session!.user.id,
        });
      }

      const updatedBillType = await BillType.findByIdAndUpdate(
        billType._id,
        { $inc: { lastNumber: 1 } },
        { new: true }
      );

      const invoiceNumber = `${updatedBillType?.prefix || "INV"}/${fy.name}/${String(updatedBillType?.lastNumber || 1).padStart(6, "0")}`;

      const items = parsed.data.services.map((s) => {
        let quantity = Number(s.units) || 1;
        let notes = s.description || "";

        if (
          s.type.toLowerCase() === "electricity" &&
          s.calculationMode === "reading"
        ) {
          const init = Number(s.initialReading) || 0;
          const curr = Number(s.currentReading) || 0;
          quantity = Math.max(0, curr - init);
          notes = `Meter Reading: ${curr} - ${init} = ${quantity} units (kWh)`;
        }

        const amount = (Number(s.rate) || 0) * quantity;
        return {
          serviceName: s.type,
          serviceCode: s.type.toUpperCase().slice(0, 4),
          calculationType: "FIXED",
          quantity,
          unit: s.type.toLowerCase() === "electricity" ? "kWh" : "unit",
          rate: Number(s.rate) || 0,
          amount,
          isTaxable: false,
          gstRate: 0,
          gstAmount: 0,
          totalAmount: amount,
          notes,
        };
      });

      const grandTotal = items.reduce((acc, i) => acc + i.totalAmount, 0);

      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + 15);

      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      await Bill.create({
        invoiceNumber,
        billTypeId: billType._id,
        financialYearId: fy._id,
        customerId: customer._id,
        locationId: parsed.data.billingLocationId ? parsed.data.billingLocationId : undefined,
        invoiceDate: startDate,
        dueDate,
        billingMonth: months[startDate.getMonth()],
        billingYear: startDate.getFullYear(),
        items,
        subtotal: grandTotal,
        discount: 0,
        taxableAmount: grandTotal,
        totalGst: 0,
        otherCharges: 0,
        roundOff: 0,
        grandTotal,
        paidAmount: 0,
        outstandingAmount: grandTotal,
        status: "unpaid",
        notes: `Initial ${billingType} billing generated on client creation`,
        createdBy: session!.user.id,
      });
    } catch {
      // Allow customer creation even if auto-billing setup encounters missing master
    }
  }

  return NextResponse.json({ data: customer }, { status: 201 });
}
