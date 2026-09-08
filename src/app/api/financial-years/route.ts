import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireAuth, requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import FinancialYear from "@/lib/models/FinancialYear";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().optional(),
});

let fyCache: { data: unknown; ts: number } | null = null;
export async function GET() {
  if (fyCache && Date.now() - fyCache.ts < 10000) {
    const res = NextResponse.json(fyCache.data);
    res.headers.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    res.headers.set("X-Cache", "HIT");
    return res;
  }
  const { error } = await requireAuth();
  if (error) return error;
  await connectDB();
  const years = await FinancialYear.find().select("name startDate endDate isActive isClosed").sort({ startDate: -1 }).lean();
  const payload = { data: years };
  fyCache = { data: payload, ts: Date.now() };
  const res = NextResponse.json(payload);
  res.headers.set("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
  res.headers.set("X-Cache", "MISS");
  return res;
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

  const exists = await FinancialYear.findOne({ name: parsed.data.name });
  if (exists) {
    return NextResponse.json({ error: "Financial year already exists" }, { status: 409 });
  }

  // If new one is active, deactivate others
  if (parsed.data.isActive) {
    await FinancialYear.updateMany({}, { isActive: false });
  }

  const fy = await FinancialYear.create({
    ...parsed.data,
    createdBy: session!.user.id,
  });

  return NextResponse.json({ data: fy }, { status: 201 });
}
