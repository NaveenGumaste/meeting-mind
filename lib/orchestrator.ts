import { createMcpConnection } from "../mcp/client";
import { extractActionItems } from "../agents/extractor";
import { crossCheckActionItems } from "../agents/cross-checker";
import { resolveActionItems, commitHumanApproval } from "../agents/resolver";
import { generateAndSendReport } from "../agents/reporter";
import { createRun, updateRunStatus, saveActionItem, saveLog } from "./db";
import { EnrichedActionItem, ResolvedActionItem } from "./schemas";

export async function runMeetingOrchestrator(
  runId: string,
  meetingTitle: string,
  transcript: string
) {
  let mcpClient = null;
  const timestamp = () => new Date().toISOString();

  try {
    // 0. Initialize run record and log
    console.info(`Starting pipeline orchestrator for run: ${runId}`);
    await createRun({
      id: runId,
      meeting_title: meetingTitle,
      raw_transcript: transcript,
      summary: "",
      status: "PROCESSING"
    });

    await saveLog({
      run_id: runId,
      agent_name: "PIPELINE",
      log_level: "INFO",
      message: "Pipeline orchestrator initialized.",
      timestamp: timestamp()
    });

    // 1. Establish MCP Connection
    await saveLog({
      run_id: runId,
      agent_name: "PIPELINE",
      log_level: "INFO",
      message: "Attempting Google Workspace MCP connection...",
      timestamp: timestamp()
    });

    mcpClient = await createMcpConnection();

    if (mcpClient) {
      await saveLog({
        run_id: runId,
        agent_name: "PIPELINE",
        log_level: "INFO",
        message: "Connected to Google Workspace MCP Server.",
        timestamp: timestamp()
      });
    } else {
      await saveLog({
        run_id: runId,
        agent_name: "PIPELINE",
        log_level: "WARNING",
        message: "Using offline local mock data (MCP connection bypassed).",
        timestamp: timestamp()
      });
    }

    // 2. Step 1: Agent 1 - Extract
    await saveLog({
      run_id: runId,
      agent_name: "EXTRACTOR",
      log_level: "INFO",
      message: "Agent 1 (Extractor) parsing meeting transcript...",
      timestamp: timestamp()
    });

    const extraction = await extractActionItems(transcript);

    await saveLog({
      run_id: runId,
      agent_name: "EXTRACTOR",
      log_level: "INFO",
      message: `Extracted ${extraction.action_items.length} action items. Summary: "${extraction.meeting_summary}"`,
      timestamp: timestamp()
    });

    // Warn of any items immediately marked for review by Agent 1
    const extractionReviewCount = extraction.action_items.filter(item => item.needs_review).length;
    if (extractionReviewCount > 0) {
      await saveLog({
        run_id: runId,
        agent_name: "EXTRACTOR",
        log_level: "WARNING",
        message: `${extractionReviewCount} items immediately flagged for low extraction confidence (< 0.60).`,
        timestamp: timestamp()
      });
    }

    // 3. Step 2: Agent 2 - Cross-Checker
    await saveLog({
      run_id: runId,
      agent_name: "CROSS_CHECKER",
      log_level: "INFO",
      message: "Agent 2 (Cross-Checker) auditing items against sheets & calendar...",
      timestamp: timestamp()
    });

    const enrichedItems = await crossCheckActionItems(mcpClient, extraction.action_items);

    // Log check reports
    for (const item of enrichedItems) {
      if (item.duplicate_of) {
        await saveLog({
          run_id: runId,
          agent_name: "CROSS_CHECKER",
          log_level: "WARNING",
          message: `Duplicate check: Task "${item.task}" duplicates Sheet Row: ${item.duplicate_of} (Completed: ${item.already_done})`,
          timestamp: timestamp()
        });
      }
      if (item.calendar_conflict) {
        await saveLog({
          run_id: runId,
          agent_name: "CROSS_CHECKER",
          log_level: "WARNING",
          message: `Calendar conflict: Task "${item.task}" conflicts: ${item.conflict_details}`,
          timestamp: timestamp()
        });
      }
      if (!item.owner_resolved) {
        await saveLog({
          run_id: runId,
          agent_name: "CROSS_CHECKER",
          log_level: "WARNING",
          message: `Owner unresolved: Unassigned task "${item.task}"`,
          timestamp: timestamp()
        });
      }
    }

    // 4. Step 3: Agent 3 - Resolver
    await saveLog({
      run_id: runId,
      agent_name: "RESOLVER",
      log_level: "INFO",
      message: "Agent 3 (Resolver) determining resolution routing...",
      timestamp: timestamp()
    });

    const resolvedItems = await resolveActionItems(mcpClient, enrichedItems);

    // Save all resolved items to DB
    for (const item of resolvedItems) {
      await saveActionItem({
        ...item,
        run_id: runId
      });
    }

    const autoCommitted = resolvedItems.filter(item => item.action_taken === "CREATE" || item.action_taken === "UPDATE").length;
    const flagged = resolvedItems.filter(item => item.action_taken === "FLAG_FOR_HUMAN").length;
    const skipped = resolvedItems.filter(item => item.action_taken === "SKIP").length;

    await saveLog({
      run_id: runId,
      agent_name: "RESOLVER",
      log_level: "INFO",
      message: `Resolution summary: Auto-committed: ${autoCommitted}, Flagged: ${flagged}, Skipped: ${skipped}`,
      timestamp: timestamp()
    });

    // 5. Step 4: Agent 4 - Reporter
    await saveLog({
      run_id: runId,
      agent_name: "REPORTER",
      log_level: "INFO",
      message: "Agent 4 (Reporter) formatting summaries and dispatching alerts...",
      timestamp: timestamp()
    });

    const summaryReport = await generateAndSendReport(meetingTitle || extraction.meeting_summary, resolvedItems);

    await saveLog({
      run_id: runId,
      agent_name: "REPORTER",
      log_level: "INFO",
      message: `Slack summary status: ${summaryReport.slack_sent ? "Dispatched" : "Logged locally (no webhook URL)"}`,
      timestamp: timestamp()
    });

    // Finalize run
    const finalStatus = flagged > 0 ? "REQUIRES_REVIEW" : "COMPLETED";
    await updateRunStatus(runId, finalStatus, extraction.meeting_summary);

    await saveLog({
      run_id: runId,
      agent_name: "PIPELINE",
      log_level: "INFO",
      message: `Pipeline run finished with status: ${finalStatus}`,
      timestamp: timestamp()
    });

    return {
      runId,
      status: finalStatus,
      meeting_summary: extraction.meeting_summary,
      action_items: resolvedItems,
      report: summaryReport
    };
  } catch (error: any) {
    console.error("Orchestrator execution error:", error);
    await saveLog({
      run_id: runId,
      agent_name: "PIPELINE",
      log_level: "ERROR",
      message: `Pipeline crashed: ${error.message || error}`,
      timestamp: timestamp()
    });
    await updateRunStatus(runId, "FAILED");
    throw error;
  } finally {
    if (mcpClient) {
      try {
        console.info("Closing Google Workspace MCP client subprocess connection...");
        await mcpClient.close();
        console.info("MCP client connection closed successfully.");
      } catch (closeError) {
        console.error("Error closing MCP client:", closeError);
      }
    }
  }
}

// Executes manual approval and commit on an item in a run
export async function runManualApprovalOrchestrator(
  runId: string,
  itemId: string,
  enrichedItem: EnrichedActionItem,
  editedFields?: Partial<EnrichedActionItem>
): Promise<ResolvedActionItem> {
  let mcpClient = null;
  const timestamp = () => new Date().toISOString();

  try {
    await saveLog({
      run_id: runId,
      agent_name: "RESOLVER",
      log_level: "INFO",
      message: `User manual override: Approving action item: "${enrichedItem.task}"...`,
      timestamp: timestamp()
    });

    mcpClient = await createMcpConnection();

    const resolved = await commitHumanApproval(mcpClient, enrichedItem, editedFields);

    // Save updated resolved item
    await saveActionItem({
      ...resolved,
      run_id: runId
    });

    await saveLog({
      run_id: runId,
      agent_name: "RESOLVER",
      log_level: "INFO",
      message: `Override committed successfully (Sheet Row: ${resolved.sheet_row_written}, Calendar Event: ${resolved.calendar_event_created})`,
      timestamp: timestamp()
    });

    return resolved;
  } catch (error: any) {
    console.error("Manual approval override error:", error);
    await saveLog({
      run_id: runId,
      agent_name: "RESOLVER",
      log_level: "ERROR",
      message: `Override failed: ${error.message || error}`,
      timestamp: timestamp()
    });
    throw error;
  } finally {
    if (mcpClient) {
      try {
        await mcpClient.close();
      } catch (e) {
        console.error("Error closing MCP client on manual commit:", e);
      }
    }
  }
}
