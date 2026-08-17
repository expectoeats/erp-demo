import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import SubLocation from "@/lib/models/SubLocation";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const schema = z.object({
  locationId: z.string().min(1, "Location is required"),
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const locationId = searchParams.get("locationId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (locationId) query.locationId = locationId;
  if (search) query.$or = [{ name: new RegExp(search, "i") }, { subLocationId: new RegExp(search, "i") }];

  const [data, total] = await Promise.all([
    SubLocation.find(query).populate("locationId", "name locationId").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SubLocation.countDocuments(query),
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

  const seq = await getNextSequence("sublocation");
  const subLocationId = `SUB-${String(seq).padStart(4, "0")}`;

  const sub = await SubLocation.create({
    ...parsed.data,
    subLocationId,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: sub }, { status: 201 });
}
