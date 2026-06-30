import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { EnrichedActionItem, ResolvedActionItem } from "../lib/schemas";
import { writeSheetsTask, updateSheetsTask } from "../mcp/sheets";
import { createCalendarEvent } from "../mcp/calendar";

export async function resolveItem(
  client: Client | null,
  item: EnrichedActionItem
): Promise<ResolvedActionItem> {
  let action_taken: "CREATE" | "UPDATE" | "SKIP" | "FLAG_FOR_HUMAN" = "CREATE";
  let reason = "New action item extracted, ready for auto-creation.";
  let sheet_row_written: string | null = null;
  let calendar_event_created: string | null = null;

  // Rule 1: Already completed in Sheets
  if (item.already_done) {
    action_taken = "SKIP";
    reason = "Task is already marked complete in the tracking sheet.";
  }
  // Rule 2: Duplicate but not completed (needs update)
  else if (item.duplicate_of) {
    action_taken = "UPDATE";
    reason = `Duplicate task found in sheet (Row ID: ${item.duplicate_of}). Deadline will be synchronized.`;
  }
  // Rule 3: Calendar conflicts
  else if (item.calendar_conflict) {
    action_taken = "FLAG_FOR_HUMAN";
    reason = `Scheduling Conflict: ${item.conflict_details}`;
  }
  // Rule 4: Low confidence extraction
  else if (item.extraction_confidence < 0.6 || item.needs_review) {
    action_taken = "FLAG_FOR_HUMAN";
    reason = `Low Extraction Confidence (${Math.round(item.extraction_confidence * 100)}%): Requires verification.`;
  }
  // Rule 5: Unresolved owner identity
  else if (!item.owner_resolved) {
    action_taken = "FLAG_FOR_HUMAN";
    reason = `Unresolved Owner Identity: "${item.owner}" could not be mapped to a team email.`;
  }

  // Check the Auto-Commit Gate:
  // If the action is CREATE or UPDATE, but confidence is low or something triggered review, flag it.
  const meetsAutoCommit = 
    item.extraction_confidence >= 0.85 && 
    !item.calendar_conflict && 
    !!item.owner_resolved && 
    !item.needs_review;

  if ((action_taken === "CREATE" || action_taken === "UPDATE") && !meetsAutoCommit) {
    action_taken = "FLAG_FOR_HUMAN";
    reason = "Queued for human review: Does not meet automatic commitment confidence checks.";
  }

  // Execute immediate writes if Auto-Committed
  if (action_taken === "CREATE") {
    try {
      sheet_row_written = await writeSheetsTask(client, {
        id: item.id,
        task: item.task,
        owner: item.owner,
        deadline: item.deadline,
        owner_resolved: item.owner_resolved,
      });

      // Create a calendar event for the owner as well if deadline is set
      if (item.owner_resolved && item.deadline) {
        calendar_event_created = await createCalendarEvent(client, {
          title: `Action Item: ${item.task}`,
          owner_resolved: item.owner_resolved,
          date: item.deadline,
        });
      }
      reason = "Auto-committed: Created tracking row and calendar invite successfully.";
    } catch (e) {
      console.error("Auto-commit creation failed:", e);
      action_taken = "FLAG_FOR_HUMAN";
      reason = "Auto-commit failed during write operations. Moved to manual queue.";
    }
  } else if (action_taken === "UPDATE") {
    try {
      if (item.duplicate_of) {
        await updateSheetsTask(client, item.duplicate_of, {
          deadline: item.deadline,
          status: "In Progress"
        });
        sheet_row_written = item.duplicate_of;
        reason = "Auto-committed: Updated deadline on existing task in tracking sheet.";
      }
    } catch (e) {
      console.error("Auto-commit update failed:", e);
      action_taken = "FLAG_FOR_HUMAN";
      reason = "Auto-commit update failed during write operations. Moved to manual queue.";
    }
  }

  return {
    ...item,
    action_taken,
    reason,
    sheet_row_written,
    calendar_event_created,
  };
}

export async function resolveActionItems(
  client: Client | null,
  items: EnrichedActionItem[]
): Promise<ResolvedActionItem[]> {
  console.info(`Applying resolution rules to ${items.length} enriched action items...`);
  
  const resolved: ResolvedActionItem[] = [];
  for (const item of items) {
    const resolvedItem = await resolveItem(client, item);
    resolved.push(resolvedItem);
  }

  return resolved;
}

// Handles human approval action from review panel
export async function commitHumanApproval(
  client: Client | null,
  item: EnrichedActionItem,
  editedFields?: Partial<EnrichedActionItem>
): Promise<ResolvedActionItem> {
  const merged = { ...item, ...editedFields };
  
  console.info(`Processing human approval for item: "${merged.task}"...`);

  let sheet_row_written: string | null = null;
  let calendar_event_created: string | null = null;
  let action_taken: "CREATE" | "UPDATE" | "SKIP" | "FLAG_FOR_HUMAN" = "CREATE";
  let reason = "Manually approved and committed by user.";

  if (merged.duplicate_of) {
    action_taken = "UPDATE";
    await updateSheetsTask(client, merged.duplicate_of, {
      deadline: merged.deadline,
      status: "In Progress"
    });
    sheet_row_written = merged.duplicate_of;
  } else {
    action_taken = "CREATE";
    sheet_row_written = await writeSheetsTask(client, {
      id: merged.id,
      task: merged.task,
      owner: merged.owner,
      deadline: merged.deadline,
      owner_resolved: merged.owner_resolved,
    });

    if (merged.owner_resolved && merged.deadline) {
      calendar_event_created = await createCalendarEvent(client, {
        title: `Action Item: ${merged.task}`,
        owner_resolved: merged.owner_resolved,
        date: merged.deadline,
      });
    }
  }

  return {
    ...merged,
    action_taken,
    reason,
    sheet_row_written,
    calendar_event_created,
  };
}
