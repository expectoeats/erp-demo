import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrgSettings extends Document {
  companyName: string;
  orgCode?: string;
  locationId?: mongoose.Types.ObjectId;
  logo?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankDetails?: string;
  invoiceFooter?: string;
  invoicePrefix: string;
  receiptPrefix: string;
  voucherPrefix: string;
  isDefault: boolean;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OrgSettingsSchema = new Schema<IOrgSettings>(
  {
    companyName: { type: String, required: true, trim: true },
    orgCode: { type: String, trim: true, uppercase: true },
    locationId: { type: Schema.Types.ObjectId, ref: "Location" },
    logo: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    pan: { type: String, trim: true, uppercase: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    website: { type: String, trim: true },
    bankDetails: { type: String, trim: true },
    invoiceFooter: { type: String, trim: true },
    invoicePrefix: { type: String, default: "INV", trim: true, uppercase: true },
    receiptPrefix: { type: String, default: "RCT", trim: true, uppercase: true },
    voucherPrefix: { type: String, default: "VCH", trim: true, uppercase: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const OrgSettings: Model<IOrgSettings> =
  mongoose.models.OrgSettings ||
  mongoose.model<IOrgSettings>("OrgSettings", OrgSettingsSchema);

export default OrgSettings;
