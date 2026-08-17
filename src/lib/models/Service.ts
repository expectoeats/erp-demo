import mongoose, { Schema, Document, Model } from "mongoose";

export type CalculationType = "AREA_RATE" | "QUANTITY_RATE" | "FIXED" | "MANUAL" | "METER";

export interface IService extends Document {
  serviceId: string;
  name: string;
  code: string;
  billingType: string;
  calculationType: CalculationType;
  isTaxable: boolean;
  gstRate: number;
  isActive: boolean;
  description?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    serviceId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    billingType: { type: String, required: true, trim: true },
    calculationType: {
      type: String,
      enum: ["AREA_RATE", "QUANTITY_RATE", "FIXED", "MANUAL", "METER"],
      default: "MANUAL",
    },
    isTaxable: { type: Boolean, default: false },
    gstRate: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Service: Model<IService> =
  mongoose.models.Service ||
  mongoose.model<IService>("Service", ServiceSchema);

export default Service;
