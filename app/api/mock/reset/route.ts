import { NextResponse } from "next/server";
import { seedMockDB, getMockSheets, getMockCalendar } from "../../../../lib/db";

export async function POST() {
  try {
    console.info("Resetting mock database to seeded values...");
    seedMockDB();
    
    const sheets = await getMockSheets();
    const calendar = await getMockCalendar();

    return NextResponse.json({
      success: true,
      message: "Mock Sheets and Calendar database reset to initial seeded states.",
      sheets,
      calendar
    });
  } catch (error: any) {
    console.error("API /api/mock/reset error:", error);
    return NextResponse.json({ error: error.message || "Failed to reset mock database." }, { status: 500 });
  }
}
