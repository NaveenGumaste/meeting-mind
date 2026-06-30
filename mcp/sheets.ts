import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getMockSheets, addMockSheetRow, updateMockSheetRow } from "../lib/db";

// Checks if two task descriptions are semantically similar (fuzzy duplicate match)
function isFuzzyMatch(t1: string, t2: string): boolean {
  const clean1 = t1.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const clean2 = t2.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  
  if (clean1 === clean2) return true;

  const words1 = clean1.split(/\s+/).filter(w => w.length > 3);
  const words2 = clean2.split(/\s+/).filter(w => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return false;

  let intersection = 0;
  words1.forEach(w => {
    if (words2.includes(w)) intersection++;
  });

  // Overlap ratio relative to the shorter text
  const minLength = Math.min(words1.length, words2.length);
  return (intersection / minLength) >= 0.5;
}

export interface SheetTask {
  id: string;
  task: string;
  owner: string;
  deadline: string | null;
  status: string;
  owner_resolved: string | null;
}

export async function readSheetsTasks(
  client: Client | null,
  ownerEmail: string | null = null
): Promise<SheetTask[]> {
  if (!client) {
    const rows = await getMockSheets() as any[];
    if (ownerEmail) {
      return rows.filter(r => r.owner_resolved === ownerEmail);
    }
    return rows;
  }

  try {
    // Call Google Sheets MCP tool
    // We fuzzy match tool name if the server exposes something like get_spreadsheet_values or similar
    const result = await client.callTool({
      name: "google_sheets_read",
      arguments: {
        range: "Sheet1!A:F"
      }
    });

    // Parse MCP output array of rows into SheetTask items
    // (Actual schema translation happens here depending on the real MCP output format)
    const content = (result.content as any)?.[0];
    const data = (typeof content === "string" ? JSON.parse(content) : content?.text ? JSON.parse(content.text) : []) as any[];
    
    return data.map((row: any, index: number) => ({
      id: row.id || `sheet-row-${index}`,
      task: row.task || row[0] || "",
      owner: row.owner || row[1] || "",
      deadline: row.deadline || row[2] || null,
      status: row.status || row[3] || "In Progress",
      owner_resolved: row.owner_resolved || row[4] || null,
    }));
  } catch (error) {
    console.error("MCP google_sheets_read tool call failed. Falling back to local data.", error);
    const rows = await getMockSheets() as any[];
    if (ownerEmail) return rows.filter(r => r.owner_resolved === ownerEmail);
    return rows;
  }
}

export async function searchSheetsTasks(
  client: Client | null,
  taskDescription: string
): Promise<{ duplicate_of: string | null; already_done: boolean }> {
  if (!client) {
    const rows = await getMockSheets() as any[];
    const match = rows.find(r => isFuzzyMatch(r.task, taskDescription));
    
    if (match) {
      return {
        duplicate_of: match.id,
        already_done: match.status?.toLowerCase() === "complete" || match.status?.toLowerCase() === "done",
      };
    }
    return { duplicate_of: null, already_done: false };
  }

  try {
    const result = await client.callTool({
      name: "google_sheets_search",
      arguments: {
        query: taskDescription
      }
    });

    const content = (result.content as any)?.[0];
    const match = (typeof content === "string" ? JSON.parse(content) : content?.text ? JSON.parse(content.text) : null) as any;

    if (match && match.id) {
      return {
        duplicate_of: match.id,
        already_done: match.status?.toLowerCase() === "complete" || match.status?.toLowerCase() === "done",
      };
    }
    return { duplicate_of: null, already_done: false };
  } catch (error) {
    console.warn("MCP google_sheets_search failed. Falling back to local search.", error);
    // Local fallback search
    const rows = await getMockSheets() as any[];
    const match = rows.find(r => isFuzzyMatch(r.task, taskDescription));
    if (match) {
      return {
        duplicate_of: match.id,
        already_done: match.status?.toLowerCase() === "complete" || match.status?.toLowerCase() === "done",
      };
    }
    return { duplicate_of: null, already_done: false };
  }
}

export async function writeSheetsTask(
  client: Client | null,
  task: { id: string; task: string; owner: string; deadline: string | null; owner_resolved: string | null }
): Promise<string> {
  const rowId = task.id || `sheet-row-${Date.now()}`;
  
  if (!client) {
    await addMockSheetRow({
      id: rowId,
      task: task.task,
      owner: task.owner,
      deadline: task.deadline,
      status: "In Progress",
      owner_resolved: task.owner_resolved,
    });
    return rowId;
  }

  try {
    await client.callTool({
      name: "google_sheets_append", // Or whatever standard write name is mapped
      arguments: {
        values: [[task.task, task.owner, task.deadline, "In Progress", task.owner_resolved, rowId]]
      }
    });
    return rowId;
  } catch (error) {
    console.error("MCP write sheets failed. Writing to local sqlite instead.", error);
    await addMockSheetRow({
      id: rowId,
      task: task.task,
      owner: task.owner,
      deadline: task.deadline,
      status: "In Progress",
      owner_resolved: task.owner_resolved,
    });
    return rowId;
  }
}

export async function updateSheetsTask(
  client: Client | null,
  id: string,
  updates: { deadline?: string | null; status?: string }
): Promise<void> {
  if (!client) {
    await updateMockSheetRow(id, updates);
    return;
  }

  try {
    await client.callTool({
      name: "google_sheets_update",
      arguments: {
        row_id: id,
        updates
      }
    });
  } catch (error) {
    console.error("MCP update sheets failed. Updating local sqlite instead.", error);
    await updateMockSheetRow(id, updates);
  }
}
