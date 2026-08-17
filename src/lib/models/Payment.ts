import mongoose, { Schema, Document, Model } from "mongoose";

export type PaymentMode = "cash" | "bank_transfer" | "upi" | "cheque" | "other";

export interface IPayment extends Document {
  paymentId: string;
  customerId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  billId: mongoose.Types.ObjectId;
  financialYearId: mongoose.Types.ObjectId;
  amount: number;
  paymentDate: Date;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  notes?: string;
  receivedBy: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    paymentId: { type: String, required: true, unique: true, trim: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    billId: { type: Schema.Types.ObjectId, ref: "Bill", required: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: "FinancialYear", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentDate: { type: Date, required: true },
    paymentMode: {
      type: String,
      enum: ["cash", "bank_transfer", "upi", "cheque", "other"],
      required: true,
    },
    referenceNumber: { type: String, trim: true },
    notes: { type: String, trim: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Payment: Model<IPayment> =
  mongoose.models.Payment ||
  mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;
