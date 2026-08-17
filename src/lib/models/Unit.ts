import mongoose, { Schema, Document, Model } from "mongoose";

export type UnitStatus = "active" | "vacant" | "inactive" | "transferred";

export interface IUnit extends Document {
  unitId: string;
  unitCode: string;
  currentOwnerId: mongoose.Types.ObjectId;
  locationId: mongoose.Types.ObjectId;
  subLocationId: mongoose.Types.ObjectId;
  propertyType?: string;
  area?: number;
  areaUnit?: string;
  status: UnitStatus;
  rentRate?: number;
  securityDeposit?: number;
  services: mongoose.Types.ObjectId[];
  gstConfig?: string;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UnitSchema = new Schema<IUnit>(
  {
    unitId: { type: String, required: true, unique: true, trim: true },
    unitCode: { type: String, required: true, unique: true, trim: true },
    currentOwnerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    subLocationId: { type: Schema.Types.ObjectId, ref: "SubLocation", required: true },
    propertyType: { type: String, trim: true },
    area: { type: Number },
    areaUnit: { type: String, default: "sq.m" },
    status: {
      type: String,
      enum: ["active", "vacant", "inactive", "transferred"],
      default: "active",
    },
    rentRate: { type: Number },
    securityDeposit: { type: Number },
    services: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    gstConfig: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

UnitSchema.index({ unitId: "text", unitCode: "text" });

const Unit: Model<IUnit> =
  mongoose.models.Unit || mongoose.model<IUnit>("Unit", UnitSchema);

export default Unit;
