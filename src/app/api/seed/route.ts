import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connection";
import User from "@/lib/models/User";
import FinancialYear from "@/lib/models/FinancialYear";
import bcrypt from "bcryptjs";

export async function POST() {
  // Only allow seeding in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  try {
    await connectDB();

    // Create super admin
    const existing = await User.findOne({ email: "admin@erp.com" });
    if (!existing) {
      const hashed = await bcrypt.hash("Admin@123", 12);
      await User.create({
        name: "Super Admin",
        email: "admin@erp.com",
        password: hashed,
        role: "super_admin",
        isActive: true,
      });
    }

    // Create default financial year
    const fyExists = await FinancialYear.findOne({ name: "2026-27" });
    if (!fyExists) {
      const admin = await User.findOne({ email: "admin@erp.com" });
      await FinancialYear.create({
        name: "2026-27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isActive: true,
        isClosed: false,
        createdBy: admin?._id,
      });
    }

    return NextResponse.json({
      message: "Seed complete. Login: admin@erp.com / Admin@123",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
