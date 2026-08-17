import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRateList extends Document {
  locationId: mongoose.Types.ObjectId;
  subLocationId?: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  financialYearId: mongoose.Types.ObjectId;
  rate: number;
  unit: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RateListSchema = new Schema<IRateList>(
  {
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    subLocationId: { type: Schema.Types.ObjectId, ref: "SubLocation" },
    serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    financialYearId: { type: Schema.Types.ObjectId, ref: "FinancialYear", required: true },
    rate: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const RateList: Model<IRateList> =
  mongoose.models.RateList ||
  mongoose.model<IRateList>("RateList", RateListSchema);

export default RateList;
