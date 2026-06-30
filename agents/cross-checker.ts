import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ActionItem, EnrichedActionItem } from "../lib/schemas";
import { searchSheetsTasks } from "../mcp/sheets";
import { checkCalendarConflicts } from "../mcp/calendar";

// Pre-defined identity mapping for known team members
const IDENTITY_MAP: Record<string, string> = {
  neha: "neha@company.com",
  arjun: "arjun@company.com",
  naveen: "naveen@company.com",
  priya: "priya@company.com",
};

export async function crossCheckItem(
  client: Client | null,
  item: ActionItem
): Promise<EnrichedActionItem> {
  const normalizedOwner = item.owner.toLowerCase().trim();
  
  // 1. Resolve owner identity to email
  const owner_resolved = IDENTITY_MAP[normalizedOwner] || null;

  // 2. Search sheets for duplicates and completion state
  let duplicate_of: string | null = null;
  let already_done = false;

  try {
    const dupCheck = await searchSheetsTasks(client, item.task);
    duplicate_of = dupCheck.duplicate_of;
    already_done = dupCheck.already_done;
  } catch (error) {
    console.error(`Duplicate check failed for task: "${item.task}"`, error);
  }

  // 3. Check Google Calendar for conflicts
  let calendar_conflict = false;
  let conflict_details: string | null = null;

  if (owner_resolved && item.deadline) {
    try {
      const conflictCheck = await checkCalendarConflicts(client, owner_resolved, item.deadline);
      calendar_conflict = conflictCheck.conflict;
      conflict_details = conflictCheck.details;
    } catch (error) {
      console.error(`Calendar conflict check failed for ${owner_resolved} on ${item.deadline}`, error);
    }
  }

  return {
    ...item,
    duplicate_of,
    already_done,
    calendar_conflict,
    conflict_details,
    owner_resolved,
  };
}

export async function crossCheckActionItems(
  client: Client | null,
  items: ActionItem[]
): Promise<EnrichedActionItem[]> {
  console.info(`Cross-checking ${items.length} extracted action items...`);
  
  const enriched: EnrichedActionItem[] = [];
  for (const item of items) {
    const enrichedItem = await crossCheckItem(client, item);
    enriched.push(enrichedItem);
  }

  return enriched;
}
