import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOwnershipTransfer extends Document {
  transferId: string;
  unitId: mongoose.Types.ObjectId;
  oldOwnerId: mongoose.Types.ObjectId;
  newOwnerId: mongoose.Types.ObjectId;
  transferDate: Date;
  reason?: string;
  approvedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OwnershipTransferSchema = new Schema<IOwnershipTransfer>(
  {
    transferId: { type: String, required: true, unique: true, trim: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    oldOwnerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    newOwnerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    transferDate: { type: Date, required: true },
    reason: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const OwnershipTransfer: Model<IOwnershipTransfer> =
  mongoose.models.OwnershipTransfer ||
  mongoose.model<IOwnershipTransfer>("OwnershipTransfer", OwnershipTransferSchema);

export default OwnershipTransfer;
