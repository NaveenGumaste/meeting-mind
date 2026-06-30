import { NextRequest, NextResponse } from "next/server";
import { runMeetingOrchestrator } from "../../../lib/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const { transcript, meeting_title } = await req.json();

    if (!transcript) {
      return NextResponse.json({ error: "Transcript content is required." }, { status: 400 });
    }

    const runId = crypto.randomUUID();
    const result = await runMeetingOrchestrator(runId, meeting_title, transcript);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/run execution error:", error);
    return NextResponse.json({ error: error.message || "Failed to execute pipeline." }, { status: 500 });
  }
}
