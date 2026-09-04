import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReceipt extends Document {
  receiptNumber: string;
  paymentId?: mongoose.Types.ObjectId;
  billId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  unitId?: mongoose.Types.ObjectId;
  financialYearId?: mongoose.Types.ObjectId;
  amount: number;
  receiptDate: Date;
  paymentMode: string;
  referenceNumber?: string;
  notes?: string;
  receivedBy?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReceiptSchema = new Schema<IReceipt>(
  {
    receiptNumber: { type: String, required: true, unique: true, trim: true },
    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },
    billId: { type: Schema.Types.ObjectId, ref: "Bill", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    financialYearId: { type: Schema.Types.ObjectId, ref: "FinancialYear" },
    amount: { type: Number, required: true, min: 0 },
    receiptDate: { type: Date, required: true },
    paymentMode: { type: String, required: true, default: "cash" },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ReceiptSchema.index({ customerId: 1, createdAt: -1 });
ReceiptSchema.index({ billId: 1 });
ReceiptSchema.index({ receiptNumber: 1 });

const Receipt: Model<IReceipt> =
  mongoose.models.Receipt ||
  mongoose.model<IReceipt>("Receipt", ReceiptSchema);

export default Receipt;
