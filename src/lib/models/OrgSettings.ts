import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrgSettings extends Document {
  companyName: string;
  logo?: string;
  address?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  bankDetails?: string;
  invoiceFooter?: string;
  invoicePrefix: string;
  receiptPrefix: string;
  voucherPrefix: string;
  updatedBy: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const OrgSettingsSchema = new Schema<IOrgSettings>(
  {
    companyName: { type: String, required: true, trim: true, default: "My Company" },
    logo: { type: String, trim: true },
    address: { type: String, trim: true },
    gstin: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    bankDetails: { type: String, trim: true },
    invoiceFooter: { type: String, trim: true },
    invoicePrefix: { type: String, default: "INV", trim: true },
    receiptPrefix: { type: String, default: "RCT", trim: true },
    voucherPrefix: { type: String, default: "VCH", trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const OrgSettings: Model<IOrgSettings> =
  mongoose.models.OrgSettings ||
  mongoose.model<IOrgSettings>("OrgSettings", OrgSettingsSchema);

export default OrgSettings;
