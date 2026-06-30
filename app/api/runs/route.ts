import { NextRequest, NextResponse } from "next/server";
import { getRuns, getActionItems, getLogs, getMockSheets, getMockCalendar } from "../../../lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  try {
    if (runId) {
      const items = await getActionItems(runId);
      const logs = await getLogs(runId);
      const sheets = await getMockSheets();
      const calendar = await getMockCalendar();

      return NextResponse.json({
        runId,
        action_items: items,
        logs,
        sheets,
        calendar
      });
    }

    const runs = await getRuns();
    const sheets = await getMockSheets();
    const calendar = await getMockCalendar();

    return NextResponse.json({
      runs,
      sheets,
      calendar
    });
  } catch (error: any) {
    console.error("API /api/runs fetch error:", error);
    return NextResponse.json({ error: error.message || "Failed to retrieve runs history." }, { status: 500 });
  }
}
