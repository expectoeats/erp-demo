import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import OrgSettings from "@/lib/models/OrgSettings";
import { z } from "zod";

const orgSchema = z.object({
  companyName: z.string().min(1, "Company Name is required"),
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

export async function GET(_: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  let orgs = await OrgSettings.find()
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  // If no org exists yet, seed a default one
  if (orgs.length === 0) {
    const seeded = await OrgSettings.create({
      companyName: "Evermore Estates Pvt. Ltd.",
      orgCode: "EVM-HQ",
      phone: "+91 98765 43210",
      email: "contact@evermore.com",
      address: "Sector 62, Noida, Uttar Pradesh",
      city: "Noida",
      state: "Uttar Pradesh",
      pincode: "201301",
      gstin: "07AAAAA0000A1Z5",
      invoicePrefix: "INV",
      receiptPrefix: "RCT",
      voucherPrefix: "VCH",
      isDefault: true,
      isActive: true,
    });
    const created = await OrgSettings.findById(seeded._id).lean();
    orgs = created ? [created] : [];
  }

  return NextResponse.json({ data: orgs });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = orgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await OrgSettings.updateMany({}, { isDefault: false });
  } else {
    // If no existing org is default, make this one default
    const existingDefault = await OrgSettings.findOne({ isDefault: true });
    if (!existingDefault) {
      data.isDefault = true;
    }
  }

  const payload = {
    ...data,
    orgCode: data.orgCode?.toUpperCase(),
    gstin: data.gstin?.toUpperCase(),
    pan: data.pan?.toUpperCase(),
    invoicePrefix: (data.invoicePrefix || "INV").toUpperCase(),
    receiptPrefix: (data.receiptPrefix || "RCT").toUpperCase(),
    voucherPrefix: (data.voucherPrefix || "VCH").toUpperCase(),
    createdBy: session!.user.id,
    updatedBy: session!.user.id,
  };

  const created = await OrgSettings.create(payload);
  const saved = await OrgSettings.findById(created._id).lean();

  return NextResponse.json({ data: saved }, { status: 201 });
}
