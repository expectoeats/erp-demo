import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubLocation extends Document {
  subLocationId: string;
  locationId: mongoose.Types.ObjectId;
  name: string;
  code?: string;
  address?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubLocationSchema = new Schema<ISubLocation>(
  {
    subLocationId: { type: String, required: true, unique: true, trim: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const SubLocation: Model<ISubLocation> =
  mongoose.models.SubLocation ||
  mongoose.model<ISubLocation>("SubLocation", SubLocationSchema);

export default SubLocation;
