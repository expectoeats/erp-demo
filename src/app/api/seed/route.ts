import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import User from "@/lib/models/User";
import FinancialYear from "@/lib/models/FinancialYear";
import bcrypt from "bcryptjs";

async function runSeed() {
  await connectDB();

  // Create super admin if it doesn't exist
  let admin = await User.findOne({ email: "admin@erp.com" });
  if (!admin) {
    const hashed = await bcrypt.hash("Admin@123", 12);
    admin = await User.create({
      name: "Super Admin",
      email: "admin@erp.com",
      password: hashed,
      role: "super_admin",
      isActive: true,
    });
  } else {
    // Reset password to default if user already exists
    const hashed = await bcrypt.hash("Admin@123", 12);
    admin.password = hashed;
    admin.isActive = true;
    await admin.save();
  }

  // Create default financial year
  const fyExists = await FinancialYear.findOne({ name: "2026-27" });
  if (!fyExists) {
    await FinancialYear.create({
      name: "2026-27",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isActive: true,
      isClosed: false,
      createdBy: admin?._id,
    });
  }

  return {
    success: true,
    message: "Admin user ready! Login with: admin@erp.com / Admin@123",
  };
}

export async function GET() {
  try {
    const result = await runSeed();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await runSeed();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
