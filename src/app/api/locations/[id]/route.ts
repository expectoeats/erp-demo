import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import { requireRole, ADMIN_ROLES } from "@/lib/auth/helpers";
import Location from "@/lib/models/Location";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  const loc = await Location.findById(id).lean();
  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: loc });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const updated = await Location.findByIdAndUpdate(id, body, { new: true });
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  await connectDB();
  const { id } = await params;
  await Location.findByIdAndUpdate(id, { isActive: false });
  return NextResponse.json({ success: true });
}
