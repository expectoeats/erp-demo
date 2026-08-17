import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  customerId: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  state?: string;
  city?: string;
  pincode?: string;
  isActive: boolean;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    customerId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    gstin: { type: String, trim: true },
    pan: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ name: "text", mobile: "text", customerId: "text" });

const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
