import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import RateList from "@/lib/models/RateList";
import { z } from "zod";

const schema = z.object({
  locationId: z.string().min(1),
  subLocationId: z.string().optional(),
  serviceId: z.string().min(1),
  financialYearId: z.string().min(1),
  rate: z.number().positive(),
  unit: z.string().min(1),
  effectiveFrom: z.string(),
  effectiveTo: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get("locationId");
  const serviceId = searchParams.get("serviceId");
  const fyId = searchParams.get("financialYearId");

  const query: Record<string, unknown> = {};
  if (locationId) query.locationId = locationId;
  if (serviceId) query.serviceId = serviceId;
  if (fyId) query.financialYearId = fyId;

  const data = await RateList.find(query)
    .populate("locationId", "name")
    .populate("subLocationId", "name")
    .populate("serviceId", "name code")
    .populate("financialYearId", "name")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const rate = await RateList.create({
    ...parsed.data,
    effectiveFrom: new Date(parsed.data.effectiveFrom),
    effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : undefined,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: rate }, { status: 201 });
}
