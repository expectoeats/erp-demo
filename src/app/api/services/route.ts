import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Service from "@/lib/models/Service";
import { getNextSequence } from "@/lib/services/counter.service";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  billingType: z.string().min(1),
  calculationType: z.enum(["AREA_RATE", "QUANTITY_RATE", "FIXED", "MANUAL", "METER"]),
  isTaxable: z.boolean().optional(),
  gstRate: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const active = searchParams.get("active");

  const query: Record<string, unknown> = {};
  if (search) query.$or = [{ name: new RegExp(search, "i") }, { code: new RegExp(search, "i") }];
  if (active === "true") query.isActive = true;

  const data = await Service.find(query).sort({ name: 1 }).lean();
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

  const exists = await Service.findOne({ code: parsed.data.code.toUpperCase() });
  if (exists) return NextResponse.json({ error: "Service code already exists" }, { status: 409 });

  const seq = await getNextSequence("service");
  const serviceId = `SVC-${String(seq).padStart(4, "0")}`;

  const service = await Service.create({
    ...parsed.data,
    serviceId,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: service }, { status: 201 });
}
