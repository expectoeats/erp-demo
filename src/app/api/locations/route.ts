import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Location from "@/lib/models/Location";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  gstin: z.string().optional(),
  gstConfig: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const skip = (page - 1) * limit;

  const query = search
    ? { $or: [{ name: new RegExp(search, "i") }, { locationId: new RegExp(search, "i") }] }
    : {};

  const [data, total] = await Promise.all([
    Location.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Location.countDocuments(query),
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

  const seq = await getNextSequence("location");
  const locationId = `LOC-${String(seq).padStart(4, "0")}`;

  const location = await Location.create({
    ...parsed.data,
    locationId,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: location }, { status: 201 });
}
