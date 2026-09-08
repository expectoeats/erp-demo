import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import User from "@/lib/models/User";
import FinancialYear from "@/lib/models/FinancialYear";
import bcrypt from "bcryptjs";

async function runSeed() {
  await connectDB();

  // Read credentials from environment variables (set in .env.local / Vercel env).
  // Falls back to hardcoded defaults so existing deployments keep working.
  const adminEmail    = process.env.ADMIN_EMAIL    ?? "admin@erp.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@123";
  const adminName     = process.env.ADMIN_NAME     ?? "Super Admin";

  const hashed = await bcrypt.hash(adminPassword, 12);

  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      name:     adminName,
      email:    adminEmail,
      password: hashed,
      role:     "super_admin",
      isActive: true,
    });
  } else {
    // Reset password and ensure account is active
    admin.password = hashed;
    admin.isActive = true;
    await admin.save();
  }

  // Create default financial year if not present
  const fyExists = await FinancialYear.findOne({ name: "2026-27" });
  if (!fyExists) {
    await FinancialYear.create({
      name:      "2026-27",
      startDate: new Date("2026-04-01"),
      endDate:   new Date("2027-03-31"),
      isActive:  true,
      isClosed:  false,
      createdBy: admin._id,
    });
  }

  return {
    success: true,
    message: `Admin ready. Login: ${adminEmail} / ${adminPassword}`,
  };
}

export async function GET() {
  try {
    return NextResponse.json(await runSeed());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
    return NextResponse.json(await runSeed());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
