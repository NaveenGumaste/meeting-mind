import { NextRequest, NextResponse } from "next/server";
import { extractActionItems } from "../../../agents/extractor";
import { createRun, saveLog } from "../../../lib/db";

export async function POST(req: NextRequest) {
  try {
    const { transcript, runId, meeting_title } = await req.json();
    if (!transcript) {
      return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    }

    const finalRunId = runId || crypto.randomUUID();
    const title = meeting_title || "Meeting Run";

    // Initialize run record in local database
    await createRun({
      id: finalRunId,
      meeting_title: title,
      raw_transcript: transcript,
      summary: "",
      status: "PROCESSING"
    });

    await saveLog({
      run_id: finalRunId,
      agent_name: "PIPELINE",
      log_level: "INFO",
      message: "Pipeline triggered. Initialized run record in database.",
      timestamp: new Date().toISOString()
    });

    await saveLog({
      run_id: finalRunId,
      agent_name: "EXTRACTOR",
      log_level: "INFO",
      message: "Agent 1 (Extractor) starting transcript parsing.",
      timestamp: new Date().toISOString()
    });

    const result = await extractActionItems(transcript);

    await saveLog({
      run_id: finalRunId,
      agent_name: "EXTRACTOR",
      log_level: "INFO",
      message: `Extraction complete. Identified ${result.action_items.length} commit candidate(s).`,
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      ...result,
      runId: finalRunId
    });
  } catch (error: any) {
    console.error("API /api/extract error:", error);
    return NextResponse.json({ error: error.message || "Extraction failed." }, { status: 500 });
  }
}
