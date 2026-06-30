import { Database } from "bun:sqlite";
import { createClient } from "@supabase/supabase-js";
import { ResolvedActionItem, RunLog } from "./schemas";

const DB_FILE = "meetingmind.db";
let sqliteDb: Database | null = null;
let supabaseClient: any = null;

// Initialize SQLite database
function getSqlite(): Database {
  if (!sqliteDb) {
    sqliteDb = new Database(DB_FILE);
    initSqliteTables(sqliteDb);
  }
  return sqliteDb;
}

// Initialize SQLite Tables
function initSqliteTables(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      meeting_title TEXT,
      raw_transcript TEXT,
      summary TEXT,
      status TEXT,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      task TEXT,
      owner TEXT,
      deadline TEXT,
      deadline_confidence TEXT,
      extraction_confidence REAL,
      source_quote TEXT,
      needs_review INTEGER,
      duplicate_of TEXT,
      already_done INTEGER,
      calendar_conflict INTEGER,
      conflict_details TEXT,
      owner_resolved TEXT,
      action_taken TEXT,
      reason TEXT,
      sheet_row_written TEXT,
      calendar_event_created TEXT,
      created_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      agent_name TEXT,
      log_level TEXT,
      message TEXT,
      timestamp TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mock_sheets (
      id TEXT PRIMARY KEY,
      task TEXT,
      owner TEXT,
      deadline TEXT,
      status TEXT,
      owner_resolved TEXT,
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mock_calendar (
      id TEXT PRIMARY KEY,
      title TEXT,
      owner_resolved TEXT,
      start_date TEXT,
      end_date TEXT
    )
  `);
}

// Initialize Supabase if keys exist
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (url && key && !supabaseClient) {
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// Helper to determine if we should use Supabase
const useSupabase = () => !!getSupabase();

// Seeding standard mock data
export function seedMockDB() {
  const db = getSqlite();

  // Clear existing mock data first
  db.run("DELETE FROM mock_sheets");
  db.run("DELETE FROM mock_calendar");

  // Insert mock sheets tasks
  const insertSheet = db.prepare(`
    INSERT INTO mock_sheets (id, task, owner, deadline, status, owner_resolved, updated_at)
    VALUES ($id, $task, $owner, $deadline, $status, $owner_resolved, $updated_at)
  `);

  // Existing task that Neha has (near overlap)
  insertSheet.run({
    $id: "sheet-row-1",
    $task: "Draft landing page copy",
    $owner: "Neha",
    $deadline: "2026-07-02",
    $status: "In Progress",
    $owner_resolved: "neha@company.com",
    $updated_at: new Date().toISOString()
  });

  // Task that Naveen is working on which is completed
  insertSheet.run({
    $id: "sheet-row-2",
    $task: "Stripe API Integration",
    $owner: "Naveen",
    $deadline: "2026-07-03",
    $status: "Complete",
    $owner_resolved: "naveen@company.com",
    $updated_at: new Date().toISOString()
  });

  // Task that Priya is working on
  insertSheet.run({
    $id: "sheet-row-3",
    $task: "Finalize launch checklist",
    $owner: "Priya",
    $deadline: "2026-06-30",
    $status: "In Progress",
    $owner_resolved: "priya@company.com",
    $updated_at: new Date().toISOString()
  });

  // Insert mock calendar events
  const insertCalendar = db.prepare(`
    INSERT INTO mock_calendar (id, title, owner_resolved, start_date, end_date)
    VALUES ($id, $title, $owner_resolved, $start_date, $end_date)
  `);

  // Arjun has an investor call prep on July 4, 2026 (staged deadline conflict!)
  insertCalendar.run({
    $id: "cal-event-1",
    $title: "Investor Call Prep",
    $owner_resolved: "arjun@company.com",
    $start_date: "2026-07-04",
    $end_date: "2026-07-04"
  });

  // Priya has an offsite on July 4, 2026
  insertCalendar.run({
    $id: "cal-event-2",
    $title: "Team Offsite",
    $owner_resolved: "priya@company.com",
    $start_date: "2026-07-04",
    $end_date: "2026-07-04"
  });
}

// Initialise DB & Seeding on first import
try {
  getSqlite();
  // We check if mock_sheets is empty, if so, seed it
  const db = getSqlite();
  const count = db.query("SELECT COUNT(*) as count FROM mock_sheets").get() as { count: number };
  if (count.count === 0) {
    seedMockDB();
  }
} catch (e) {
  console.error("Failed to initialize database", e);
}

// Database API Methods
export async function getRuns() {
  if (useSupabase()) {
    const { data, error } = await getSupabase().from("runs").select("*").order("created_at", { ascending: false });
    if (!error) return data;
  }
  const db = getSqlite();
  return db.query("SELECT * FROM runs ORDER BY created_at DESC").all();
}

export async function createRun(run: { id: string; meeting_title: string; raw_transcript: string; summary: string; status: string }) {
  const createdAt = new Date().toISOString();
  if (useSupabase()) {
    await getSupabase().from("runs").insert([{ ...run, created_at: createdAt }]);
  }
  const db = getSqlite();
  db.prepare(`
    INSERT INTO runs (id, meeting_title, raw_transcript, summary, status, created_at)
    VALUES ($id, $meeting_title, $raw_transcript, $summary, $status, $created_at)
  `).run({
    $id: run.id,
    $meeting_title: run.meeting_title,
    $raw_transcript: run.raw_transcript,
    $summary: run.summary,
    $status: run.status,
    $created_at: createdAt
  });
}

export async function updateRunStatus(id: string, status: string, summary?: string) {
  if (useSupabase()) {
    const updateObj: any = { status };
    if (summary) updateObj.summary = summary;
    await getSupabase().from("runs").update(updateObj).eq("id", id);
  }
  const db = getSqlite();
  if (summary) {
    db.prepare("UPDATE runs SET status = $status, summary = $summary WHERE id = $id").run({ $status: status, $summary: summary, $id: id });
  } else {
    db.prepare("UPDATE runs SET status = $status WHERE id = $id").run({ $status: status, $id: id });
  }
}

export async function getActionItems(runId: string) {
  if (useSupabase()) {
    const { data, error } = await getSupabase().from("action_items").select("*").eq("run_id", runId);
    if (!error) return data.map((item: any) => ({
      ...item,
      needs_review: !!item.needs_review,
      already_done: !!item.already_done,
      calendar_conflict: !!item.calendar_conflict
    }));
  }
  const db = getSqlite();
  const items = db.prepare("SELECT * FROM action_items WHERE run_id = $run_id").all(runId) as any[];
  return items.map(item => ({
    ...item,
    needs_review: item.needs_review === 1,
    already_done: item.already_done === 1,
    calendar_conflict: item.calendar_conflict === 1
  }));
}

export async function saveActionItem(item: ResolvedActionItem & { run_id: string }) {
  if (useSupabase()) {
    await getSupabase().from("action_items").upsert([{
      ...item,
      needs_review: item.needs_review ? 1 : 0,
      already_done: item.already_done ? 1 : 0,
      calendar_conflict: item.calendar_conflict ? 1 : 0,
      created_at: new Date().toISOString()
    }]);
  }
  const db = getSqlite();
  db.prepare(`
    INSERT OR REPLACE INTO action_items (
      id, run_id, task, owner, deadline, deadline_confidence, extraction_confidence,
      source_quote, needs_review, duplicate_of, already_done, calendar_conflict,
      conflict_details, owner_resolved, action_taken, reason, sheet_row_written,
      calendar_event_created, created_at
    ) VALUES (
      $id, $run_id, $task, $owner, $deadline, $deadline_confidence, $extraction_confidence,
      $source_quote, $needs_review, $duplicate_of, $already_done, $calendar_conflict,
      $conflict_details, $owner_resolved, $action_taken, $reason, $sheet_row_written,
      $calendar_event_created, $created_at
    )
  `).run({
    $id: item.id,
    $run_id: item.run_id,
    $task: item.task,
    $owner: item.owner,
    $deadline: item.deadline,
    $deadline_confidence: item.deadline_confidence,
    $extraction_confidence: item.extraction_confidence,
    $source_quote: item.source_quote,
    $needs_review: item.needs_review ? 1 : 0,
    $duplicate_of: item.duplicate_of,
    $already_done: item.already_done ? 1 : 0,
    $calendar_conflict: item.calendar_conflict ? 1 : 0,
    $conflict_details: item.conflict_details,
    $owner_resolved: item.owner_resolved,
    $action_taken: item.action_taken,
    $reason: item.reason,
    $sheet_row_written: item.sheet_row_written,
    $calendar_event_created: item.calendar_event_created,
    $created_at: new Date().toISOString()
  });
}

export async function saveLog(log: RunLog) {
  if (useSupabase()) {
    await getSupabase().from("logs").insert([log]);
  }
  const db = getSqlite();
  db.prepare(`
    INSERT INTO logs (id, run_id, agent_name, log_level, message, timestamp)
    VALUES ($id, $run_id, $agent_name, $log_level, $message, $timestamp)
  `).run({
    $id: log.id || crypto.randomUUID(),
    $run_id: log.run_id,
    $agent_name: log.agent_name,
    $log_level: log.log_level,
    $message: log.message,
    $timestamp: log.timestamp
  });
}

export async function getLogs(runId: string) {
  if (useSupabase()) {
    const { data, error } = await getSupabase().from("logs").select("*").eq("run_id", runId).order("timestamp", { ascending: true });
    if (!error) return data;
  }
  const db = getSqlite();
  return db.prepare("SELECT * FROM logs WHERE run_id = $run_id ORDER BY timestamp ASC").all(runId);
}

// Mock Sheets Storage API
export async function getMockSheets() {
  const db = getSqlite();
  return db.query("SELECT * FROM mock_sheets ORDER BY updated_at DESC").all();
}

export async function addMockSheetRow(row: { id: string; task: string; owner: string; deadline: string | null; status: string; owner_resolved: string | null }) {
  const db = getSqlite();
  db.prepare(`
    INSERT INTO mock_sheets (id, task, owner, deadline, status, owner_resolved, updated_at)
    VALUES ($id, $task, $owner, $deadline, $status, $owner_resolved, $updated_at)
  `).run({
    $id: row.id,
    $task: row.task,
    $owner: row.owner,
    $deadline: row.deadline,
    $status: row.status,
    $owner_resolved: row.owner_resolved,
    $updated_at: new Date().toISOString()
  });
}

export async function updateMockSheetRow(id: string, updates: { deadline?: string | null; status?: string; task?: string; owner?: string; owner_resolved?: string | null }) {
  const db = getSqlite();
  const setClauses: string[] = [];
  const params: any = { $id: id };

  Object.entries(updates).forEach(([key, val]) => {
    setClauses.push(`${key} = $${key}`);
    params[`$${key}`] = val;
  });

  setClauses.push("updated_at = $updated_at");
  params["$updated_at"] = new Date().toISOString();

  db.prepare(`
    UPDATE mock_sheets SET ${setClauses.join(", ")} WHERE id = $id
  `).run(params);
}

// Mock Calendar Storage API
export async function getMockCalendar() {
  const db = getSqlite();
  return db.query("SELECT * FROM mock_calendar").all();
}

export async function addMockCalendarEvent(event: { id: string; title: string; owner_resolved: string; start_date: string; end_date: string }) {
  const db = getSqlite();
  db.prepare(`
    INSERT INTO mock_calendar (id, title, owner_resolved, start_date, end_date)
    VALUES ($id, $title, $owner_resolved, $start_date, $end_date)
  `).run({
    $id: event.id,
    $title: event.title,
    $owner_resolved: event.owner_resolved,
    $start_date: event.start_date,
    $end_date: event.end_date
  });
}
