import { NextRequest, NextResponse } from "next/server";
import { createMcpConnection } from "../../../mcp/client";
import { crossCheckActionItems } from "../../../agents/cross-checker";
import { saveLog } from "../../../lib/db";

export async function POST(req: NextRequest) {
  let client = null;
  try {
    const { action_items, runId } = await req.json();
    if (!action_items || !Array.isArray(action_items)) {
      return NextResponse.json({ error: "action_items array is required." }, { status: 400 });
    }
    if (!runId) {
      return NextResponse.json({ error: "runId is required." }, { status: 400 });
    }

    await saveLog({
      run_id: runId,
      agent_name: "CROSS_CHECKER",
      log_level: "INFO",
      message: "Agent 2 (Cross-Checker) starting Sheets and Calendar audits.",
      timestamp: new Date().toISOString()
    });

    client = await createMcpConnection();

    if (!client) {
      await saveLog({
        run_id: runId,
        agent_name: "CROSS_CHECKER",
        log_level: "WARNING",
        message: "No MCP credentials. Using offline mock datasets for sheets/calendar audits.",
        timestamp: new Date().toISOString()
      });
    }

    const result = await crossCheckActionItems(client, action_items);

    // Log diagnostic findings
    for (const item of result) {
      if (item.duplicate_of) {
        await saveLog({
          run_id: runId,
          agent_name: "CROSS_CHECKER",
          log_level: "WARNING",
          message: `Duplicate Check: Task "${item.task}" duplicates Sheet Row ${item.duplicate_of} (Status: ${item.already_done ? "Complete" : "Active"}).`,
          timestamp: new Date().toISOString()
        });
      }
      if (item.calendar_conflict) {
        await saveLog({
          run_id: runId,
          agent_name: "CROSS_CHECKER",
          log_level: "WARNING",
          message: `Calendar check: Blocked schedule found: ${item.conflict_details}.`,
          timestamp: new Date().toISOString()
        });
      }
    }

    await saveLog({
      run_id: runId,
      agent_name: "CROSS_CHECKER",
      log_level: "INFO",
      message: "Audits completed. Handing over enriched dataset to Resolver.",
      timestamp: new Date().toISOString()
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Cross-check failed." }, { status: 500 });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.error("Error closing MCP client:", e);
      }
    }
  }
}
