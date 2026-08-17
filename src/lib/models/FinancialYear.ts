import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFinancialYear extends Document {
  name: string;        // e.g. "2026-27"
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isClosed: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialYearSchema = new Schema<IFinancialYear>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    isClosed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const FinancialYear: Model<IFinancialYear> =
  mongoose.models.FinancialYear ||
  mongoose.model<IFinancialYear>("FinancialYear", FinancialYearSchema);

export default FinancialYear;
