import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import OrgSettings from "@/lib/models/OrgSettings";
import { z } from "zod";

const updateSchema = z.object({
  companyName: z.string().min(1).optional(),
  orgCode: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional().or(z.literal("")),
  website: z.string().optional(),
  bankDetails: z.string().optional(),
  invoiceFooter: z.string().optional(),
  invoicePrefix: z.string().optional(),
  receiptPrefix: z.string().optional(),
  voucherPrefix: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const org = await OrgSettings.findById(id).lean();

  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  return NextResponse.json({ data: org });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.isDefault) {
    await OrgSettings.updateMany({ _id: { $ne: id } }, { isDefault: false });
  }

  const updatePayload: Record<string, unknown> = {
    ...data,
    updatedBy: session!.user.id,
  };

  if (data.orgCode) updatePayload.orgCode = data.orgCode.toUpperCase();
  if (data.gstin) updatePayload.gstin = data.gstin.toUpperCase();
  if (data.pan) updatePayload.pan = data.pan.toUpperCase();
  if (data.invoicePrefix) updatePayload.invoicePrefix = data.invoicePrefix.toUpperCase();
  if (data.receiptPrefix) updatePayload.receiptPrefix = data.receiptPrefix.toUpperCase();
  if (data.voucherPrefix) updatePayload.voucherPrefix = data.voucherPrefix.toUpperCase();

  const updated = await OrgSettings.findByIdAndUpdate(id, updatePayload, { new: true }).lean();

  if (!updated) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;

  const totalCount = await OrgSettings.countDocuments({ isActive: true });
  if (totalCount <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only active organization profile." },
      { status: 400 }
    );
  }

  await OrgSettings.findByIdAndUpdate(id, { isActive: false, isDefault: false });

  // If deleted org was default, assign default to first active
  const remainingDefault = await OrgSettings.findOne({ isDefault: true, isActive: true });
  if (!remainingDefault) {
    const firstActive = await OrgSettings.findOne({ isActive: true });
    if (firstActive) {
      await OrgSettings.findByIdAndUpdate(firstActive._id, { isDefault: true });
    }
  }

  return NextResponse.json({ success: true });
}
