import mongoose, { Schema, Document, Model } from "mongoose";

export type MeterType = "electricity" | "water" | "lpg" | "other";

export interface IMeter extends Document {
  meterId: string;
  unitId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  meterType: MeterType;
  meterNumber: string;
  initialReading: number;
  currentReading: number;
  isActive: boolean;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MeterSchema = new Schema<IMeter>(
  {
    meterId: { type: String, required: true, unique: true, trim: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    meterType: {
      type: String,
      enum: ["electricity", "water", "lpg", "other"],
      required: true,
    },
    meterNumber: { type: String, required: true, trim: true },
    initialReading: { type: Number, default: 0 },
    currentReading: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const Meter: Model<IMeter> =
  mongoose.models.Meter || mongoose.model<IMeter>("Meter", MeterSchema);

export default Meter;
