import mongoose, { Schema, Document, Model } from "mongoose";

export type LedgerEntryType = "bill" | "payment" | "waiver" | "credit" | "debit" | "transfer";

export interface ILedgerEntry extends Document {
  customerId: mongoose.Types.ObjectId;
  unitId?: mongoose.Types.ObjectId;
  financialYearId: mongoose.Types.ObjectId;
  date: Date;
  particular: string;
  entryType: LedgerEntryType;
  referenceId?: mongoose.Types.ObjectId;
  referenceModel?: string;
  referenceNumber?: string;
  debit: number;
  credit: number;
  balance: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    financialYearId: { type: Schema.Types.ObjectId, ref: "FinancialYear", required: true },
    date: { type: Date, required: true },
    particular: { type: String, required: true, trim: true },
    entryType: {
      type: String,
      enum: ["bill", "payment", "waiver", "credit", "debit", "transfer"],
      required: true,
    },
    referenceId: { type: Schema.Types.ObjectId },
    referenceModel: { type: String },
    referenceNumber: { type: String, trim: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    balance: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

LedgerEntrySchema.index({ customerId: 1, date: 1 });
LedgerEntrySchema.index({ customerId: 1, financialYearId: 1 });

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry ||
  mongoose.model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);

export default LedgerEntry;
