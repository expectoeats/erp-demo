import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBillItem {
  serviceId: mongoose.Types.ObjectId;
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

export type BillStatus = "unpaid" | "partially_paid" | "paid" | "overdue" | "cancelled";

export interface IBill extends Document {
  invoiceNumber: string;
  billTypeId: mongoose.Types.ObjectId;
  financialYearId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  unitId?: mongoose.Types.ObjectId;
  locationId?: mongoose.Types.ObjectId;
  subLocationId?: mongoose.Types.ObjectId;
  invoiceDate: Date;
  dueDate: Date;
  billingMonth: string;
  billingYear: number;
  items: IBillItem[];
  subtotal: number;
  discount: number;
  taxableAmount: number;
  totalGst: number;
  otherCharges: number;
  roundOff: number;
  grandTotal: number;
  paidAmount: number;
  outstandingAmount: number;
  status: BillStatus;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  cancelledBy?: mongoose.Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillItemSchema = new Schema<IBillItem>({
  serviceId: { type: Schema.Types.ObjectId, ref: "Service" },
  serviceName: { type: String, required: true },
  serviceCode: { type: String },
  calculationType: { type: String, default: "FIXED" },
  quantity: { type: Number, required: true, default: 1 },
  unit: { type: String, default: "unit" },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true },
  isTaxable: { type: Boolean, default: false },
  gstRate: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  notes: { type: String },
}, { _id: false });

const BillSchema = new Schema<IBill>(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    billTypeId: { type: Schema.Types.ObjectId, ref: "BillType", required: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: "FinancialYear", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    subLocationId: { type: Schema.Types.ObjectId, ref: "SubLocation" },
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    billingMonth: { type: String, required: true },
    billingYear: { type: Number, required: true },
    items: [BillItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    totalGst: { type: Number, default: 0 },
    otherCharges: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    outstandingAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid", "overdue", "cancelled"],
      default: "unpaid",
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

BillSchema.index({ invoiceNumber: 1 });
BillSchema.index({ customerId: 1, status: 1 });
BillSchema.index({ unitId: 1 });
BillSchema.index({ financialYearId: 1, billingMonth: 1 });

const Bill: Model<IBill> =
  mongoose.models.Bill || mongoose.model<IBill>("Bill", BillSchema);

export default Bill;
