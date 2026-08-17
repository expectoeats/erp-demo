import mongoose, { Schema, Document, Model } from "mongoose";

export type VoucherType = "debit" | "credit" | "transfer" | "waiver" | "payment";

export interface IVoucher extends Document {
  voucherNumber: string;
  voucherType: VoucherType;
  date: Date;
  financialYearId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  unitId?: mongoose.Types.ObjectId;
  billId?: mongoose.Types.ObjectId;
  amount: number;
  reference?: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdBy: mongoose.Types.ObjectId;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VoucherSchema = new Schema<IVoucher>(
  {
    voucherNumber: { type: String, required: true, unique: true, trim: true },
    voucherType: {
      type: String,
      enum: ["debit", "credit", "transfer", "waiver", "payment"],
      required: true,
    },
    date: { type: Date, required: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: "FinancialYear", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    billId: { type: Schema.Types.ObjectId, ref: "Bill" },
    amount: { type: Number, required: true, min: 0.01 },
    reference: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

const Voucher: Model<IVoucher> =
  mongoose.models.Voucher ||
  mongoose.model<IVoucher>("Voucher", VoucherSchema);

export default Voucher;
