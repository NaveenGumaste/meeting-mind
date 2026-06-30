import { NextRequest, NextResponse } from "next/server";
import { createMcpConnection } from "../../../mcp/client";
import { resolveActionItems } from "../../../agents/resolver";
import { runManualApprovalOrchestrator } from "../../../lib/orchestrator";
import { saveActionItem, updateRunStatus, saveLog } from "../../../lib/db";

export async function POST(req: NextRequest) {
  let mcpClient = null;
  try {
    const body = await req.json();

    // Case 1: Sequential pipeline run (Agent 3 - Resolver logic on enriched items)
    if (body.enriched_items && Array.isArray(body.enriched_items)) {
      const { enriched_items, runId, meeting_summary } = body;
      if (!runId) {
        return NextResponse.json({ error: "runId is required for resolver run." }, { status: 400 });
      }

      mcpClient = await createMcpConnection();
      const resolved = await resolveActionItems(mcpClient, enriched_items);

      // Save resolved items to database
      for (const item of resolved) {
        await saveActionItem({
          ...item,
          run_id: runId
        });
      }

      // Update run status based on review requirements
      const hasFlagged = resolved.some(item => item.action_taken === "FLAG_FOR_HUMAN");
      const finalStatus = hasFlagged ? "REQUIRES_REVIEW" : "COMPLETED";
      await updateRunStatus(runId, finalStatus, meeting_summary);

      await saveLog({
        run_id: runId,
        agent_name: "RESOLVER",
        log_level: "INFO",
        message: `Resolution complete. Auto-committed: ${resolved.filter(i => i.action_taken === "CREATE" || i.action_taken === "UPDATE").length}, Flagged: ${resolved.filter(i => i.action_taken === "FLAG_FOR_HUMAN").length}`,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        action_items: resolved,
        status: finalStatus
      });
    }

    // Case 2: Human-in-the-loop override approval
    const { runId, itemId, item, editedFields } = body;
    if (!runId || !itemId || !item) {
      return NextResponse.json({ error: "runId, itemId, and item payload are required for manual approval." }, { status: 400 });
    }

    const resolved = await runManualApprovalOrchestrator(runId, itemId, item, editedFields);
    return NextResponse.json(resolved);
  } catch (error: any) {
    console.error("API /api/resolve error:", error);
    return NextResponse.json({ error: error.message || "Operation failed." }, { status: 500 });
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (e) {
        console.error("Error closing MCP client:", e);
      }
    }
  }
}
