import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMeterReading extends Document {
  meterId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingDate: Date;
  billingMonth: string;
  billingYear: number;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MeterReadingSchema = new Schema<IMeterReading>(
  {
    meterId: { type: Schema.Types.ObjectId, ref: "Meter", required: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    consumption: { type: Number, required: true },
    readingDate: { type: Date, required: true },
    billingMonth: { type: String, required: true },
    billingYear: { type: Number, required: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const MeterReading: Model<IMeterReading> =
  mongoose.models.MeterReading ||
  mongoose.model<IMeterReading>("MeterReading", MeterReadingSchema);

export default MeterReading;
