import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomerService {
  type: string;
  rate: number;
  units: number;
  description?: string;
}

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
  billingLocationId?: mongoose.Types.ObjectId;
  billingType?: "monthly" | "quarterly" | "yearly";
  billingStartDate?: Date;
  nextBillingDate?: Date;
  services?: ICustomerService[];
  isActive: boolean;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerServiceSchema = new Schema<ICustomerService>(
  {
    type: { type: String, required: true },
    rate: { type: Number, default: 0 },
    units: { type: Number, default: 1 },
    description: { type: String, trim: true },
  },
  { _id: false }
);

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
    billingLocationId: { type: Schema.Types.ObjectId, ref: "Location" },
    billingType: {
      type: String,
      enum: ["monthly", "quarterly", "yearly"],
      default: "monthly",
    },
    billingStartDate: { type: Date },
    nextBillingDate: { type: Date },
    services: [CustomerServiceSchema],
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
