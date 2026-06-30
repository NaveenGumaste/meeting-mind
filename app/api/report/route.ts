import { NextRequest, NextResponse } from "next/server";
import { generateAndSendReport } from "../../../agents/reporter";

export async function POST(req: NextRequest) {
  try {
    const { meeting_title, resolved_items } = await req.json();
    if (!resolved_items || !Array.isArray(resolved_items)) {
      return NextResponse.json({ error: "resolved_items array is required." }, { status: 400 });
    }

    const result = await generateAndSendReport(meeting_title || "Launch Checkpoint", resolved_items);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Reporting failed." }, { status: 500 });
  }
}
