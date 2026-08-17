import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBillType extends Document {
  name: string;
  code: string;
  prefix: string;
  lastNumber: number;
  description?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BillTypeSchema = new Schema<IBillType>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    prefix: { type: String, required: true, trim: true },
    lastNumber: { type: Number, default: 0 },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const BillType: Model<IBillType> =
  mongoose.models.BillType ||
  mongoose.model<IBillType>("BillType", BillTypeSchema);

export default BillType;
