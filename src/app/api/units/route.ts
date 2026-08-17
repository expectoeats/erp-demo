import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Unit from "@/lib/models/Unit";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const schema = z.object({
  unitCode: z.string().min(1, "Unit code is required"),
  currentOwnerId: z.string().min(1, "Customer is required"),
  locationId: z.string().min(1, "Location is required"),
  subLocationId: z.string().min(1, "Sub-location is required"),
  propertyType: z.string().optional(),
  area: z.number().optional(),
  areaUnit: z.string().optional(),
  status: z.enum(["active", "vacant", "inactive", "transferred"]).optional(),
  rentRate: z.number().optional(),
  securityDeposit: z.number().optional(),
  services: z.array(z.string()).optional(),
  gstConfig: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const locationId = searchParams.get("locationId");
  const subLocationId = searchParams.get("subLocationId");
  const status = searchParams.get("status");
  const customerId = searchParams.get("customerId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (search) query.$or = [{ unitCode: new RegExp(search, "i") }, { unitId: new RegExp(search, "i") }];
  if (locationId) query.locationId = locationId;
  if (subLocationId) query.subLocationId = subLocationId;
  if (status) query.status = status;
  if (customerId) query.currentOwnerId = customerId;

  const [data, total] = await Promise.all([
    Unit.find(query)
      .populate("currentOwnerId", "name customerId mobile")
      .populate("locationId", "name locationId")
      .populate("subLocationId", "name subLocationId")
      .populate("services", "name code")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Unit.countDocuments(query),
  ]);

  return NextResponse.json({ data, total, page, limit });
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

  const codeExists = await Unit.findOne({ unitCode: parsed.data.unitCode });
  if (codeExists) return NextResponse.json({ error: "Unit code already exists" }, { status: 409 });

  const seq = await getNextSequence("unit");
  const unitId = `UNIT-${String(seq).padStart(6, "0")}`;

  const unit = await Unit.create({
    ...parsed.data,
    unitId,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: unit }, { status: 201 });
}
