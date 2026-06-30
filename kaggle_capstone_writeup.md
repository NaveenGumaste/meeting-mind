# MeetingMind — Capstone Project Technical Write-up Reference

## 1. Project Identity
* **What is the project name?**
  * **MeetingMind** (referred to in the logs as `meetingmind-orchestrator` and styled as `MeetingMind MCP`).
* **What problem does it solve?**
  * MeetingMind automates post-meeting administration by extracting action items from raw transcripts, cross-referencing them against tracking sheets for duplicates and calendar schedules for conflicts, auto-committing high-confidence bookings, and routing ambiguous or conflicting items to a human-in-the-loop verification panel.
* **Which Kaggle track does this fit?**
  * **Concierge Agents** or **Agents for Business**. It fits the **Concierge Agents** track since it manages calendars, schedules events, tracks tasks on behalf of multiple individuals, and coordinates administrative tasks with a human-in-the-loop safety valve.
* **What is the real-world value proposition?**
  * Rather than requiring project managers to spend hours parsing transcripts, messaging owners, looking up schedules, and updating sheets, MeetingMind automates this pipeline end-to-end. By checking calendars and tracking sheets automatically before booking, it ensures alignment, prevents double-booking, and eliminates task duplication.

---

## 2. Agent Architecture

The system utilizes a sequential pipeline architecture consisting of **four distinct agents** coordinated by a central orchestrator.

### Agent 1: Extractor (EXTRACTOR)
* **Role:** Parses raw transcripts, extracts deliverables, sets deadlines (resolves relative dates like "end of week" to dates), assigns owners, selects source quotes, and assigns confidence levels.
* **File Path:** [agents/extractor.ts](file:///Users/naveen/Documents/meetingmind/agents/extractor.ts)
* **Model/LLM:** Defaults to **Gemini** (`gemini-2.5-flash` via `@google/genai`). Falls back to OpenAI (`gpt-4o`) or Anthropic (`claude-3-5-sonnet-20241022`) if respective API keys are detected, and resorts to a deterministic local mock extraction logic if offline.
* **System Prompt:**
  ```text
  You are a precise meeting analyst. Extract every action item from the transcript below.

  For each action item output:
  - task: specific task committed to (verb + noun, be precise)
  - owner: person responsible (exact name as mentioned, or "UNKNOWN")
  - deadline: ISO date (YYYY-MM-DD) if explicit; inferred date if implied ("end of week" → next Friday from June 30, 2026); null if absent
  - deadline_confidence: "explicit" | "inferred" | "none"
  - extraction_confidence: float 0.0–1.0 (certainty this is a real committed action, not a vague suggestion)
  - source_quote: exact phrase from transcript that led to this extraction

  Output ONLY valid JSON matching the schema. No explanation. No preamble.

  Schema:
  {
    "action_items": [
      {
        "id": "uuid-v4",
        "task": "string",
        "owner": "string",
        "deadline": "YYYY-MM-DD | null",
        "deadline_confidence": "explicit | inferred | none",
        "extraction_confidence": 0.0-1.0,
        "source_quote": "string",
        "needs_review": false
      }
    ],
    "meeting_summary": "one sentence summary of meeting purpose"
  }

  Guardrail: If extraction_confidence < 0.6, set "needs_review": true. These items must pass human-approval.
  ```
* **Input Schema:** A string containing raw meeting transcripts or notes.
* **Output Schema:** JSON matching the validated Zod `MeetingExtractionSchema` in [lib/schemas.ts](file:///Users/naveen/Documents/meetingmind/lib/schemas.ts):
  ```typescript
  export const ActionItemSchema = z.object({
    id: z.string().uuid(),
    task: z.string().min(1, "Task description is required"),
    owner: z.string().default("UNKNOWN"),
    deadline: z.string().nullable().refine((val) => {
      if (!val) return true;
      return /^\d{4}-\d{2}-\d{2}$/.test(val);
    }, "Deadline must be in YYYY-MM-DD format"),
    deadline_confidence: z.enum(["explicit", "inferred", "none"]),
    extraction_confidence: z.number().min(0.0).max(1.0),
    source_quote: z.string(),
    needs_review: z.boolean().default(false),
  });

  export const MeetingExtractionSchema = z.object({
    action_items: z.array(ActionItemSchema),
    meeting_summary: z.string(),
  });
  ```

### Agent 2: Cross-Checker (CROSS_CHECKER)
* **Role:** Resolves owner identities, checks tracking sheets for existing duplicates, and checks calendars for schedule conflicts.
* **File Path:** [agents/cross-checker.ts](file:///Users/naveen/Documents/meetingmind/agents/cross-checker.ts)
* **Model/LLM:** N/A (Rule-based script calling MCP tools).
* **System Prompt:** N/A
* **Input Schema:** `ActionItem[]` (the array extracted by Agent 1).
* **Output Schema:** Enriched action items adhering to the Zod schema:
  ```typescript
  export const EnrichedActionItemSchema = ActionItemSchema.extend({
    duplicate_of: z.string().nullable().default(null),
    already_done: z.boolean().default(false),
    calendar_conflict: z.boolean().default(false),
    conflict_details: z.string().nullable().default(null),
    owner_resolved: z.string().email().nullable().default(null),
  });
  ```

### Agent 3: Resolver (RESOLVER)
* **Role:** Executes the auto-commit gate decisions. Flags items for review or auto-commits inserts/updates to Google Sheets and books calendar events using MCP tools.
* **File Path:** [agents/resolver.ts](file:///Users/naveen/Documents/meetingmind/agents/resolver.ts)
* **Model/LLM:** N/A (Rules and MCP Tool Client).
* **System Prompt:** N/A
* **Input Schema:** `EnrichedActionItem[]` and/or user overrides from the manual verification panel.
* **Output Schema:** Resolved items adhering to the Zod schema:
  ```typescript
  export const ResolvedActionItemSchema = EnrichedActionItemSchema.extend({
    action_taken: z.enum(["CREATE", "UPDATE", "SKIP", "FLAG_FOR_HUMAN"]),
    reason: z.string(),
    sheet_row_written: z.string().nullable().default(null),
    calendar_event_created: z.string().nullable().default(null),
  });
  ```

### Agent 4: Reporter (REPORTER)
* **Role:** Compiles a visual execution report and sends markdown notifications to Slack.
* **File Path:** [agents/reporter.ts](file:///Users/naveen/Documents/meetingmind/agents/reporter.ts)
* **Model/LLM:** N/A (Rule-based dispatcher).
* **System Prompt:** N/A
* **Input Schema:** `ResolvedActionItem[]` and the `meetingTitle` string.
* **Output Schema:** `RunSummary` object:
  ```typescript
  export interface RunSummary {
    meeting_title: string;
    total_extracted: number;
    created: number;
    updated: number;
    flagged: number;
    skipped: number;
    summary_text: string;
    slack_sent: boolean;
  }
  ```

### Agent Communication & Coordination
* **Pattern:** Sequential Pipeline.
* **Orchestrator:** [lib/orchestrator.ts](file:///Users/naveen/Documents/meetingmind/lib/orchestrator.ts) manages the sequence. It instantiates the MCP connection, runs Step 1 (Extractor) to get candidate tasks, runs Step 2 (Cross-Checker) to check constraints, runs Step 3 (Resolver) to execute auto-commits or flag items, and runs Step 4 (Reporter) to broadcast the summary.
* **Agent Flow Diagram:**
  ```mermaid
  sequenceDiagram
      autonumber
      participant U as User / Client
      participant O as Orchestrator (orchestrator.ts)
      participant A1 as Extractor Agent (extractor.ts)
      participant A2 as Cross-Checker Agent (cross-checker.ts)
      participant A3 as Resolver Agent (resolver.ts)
      participant A4 as Reporter Agent (reporter.ts)
      participant MCP as Google Workspace MCP Server
      participant DB as Database (SQLite/Supabase)

      U->>O: executePipeline(transcript, title)
      O->>DB: createRun (status: PROCESSING)
      O->>A1: extractActionItems(transcript)
      Note over A1: Run LLM (Gemini 2.5 Flash)<br/>Extract items, confidence, source quotes.
      A1-->>O: MeetingExtraction (action_items, meeting_summary)
      O->>A2: crossCheckActionItems(mcpClient, items)
      loop For each item
          A2->>MCP: Search spreadsheet (google_sheets_search)
          MCP-->>A2: Match (duplicate_of, status)
          A2->>MCP: List calendar events (google_calendar_list_events)
          MCP-->>A2: Overlap events (calendar_conflict)
      end
      A2-->>O: EnrichedActionItem[]
      O->>A3: resolveActionItems(mcpClient, enrichedItems)
      loop For each item
          Note over A3: Check auto-commit criteria:<br/>Confidence >= 0.85, Owner resolved,<br/>No conflicts, No needs_review
          alt Auto-Commit: CREATE
              A3->>MCP: google_sheets_append
              A3->>MCP: google_calendar_create_event
          alt Auto-Commit: UPDATE
              A3->>MCP: google_sheets_update
          else Flag or Skip
              Note over A3: Mark for review or skip
          end
      end
      A3->>DB: saveActionItem()
      A3-->>O: ResolvedActionItem[]
      O->>A4: generateAndSendReport(title, resolvedItems)
      A4->>U: Post to Slack Webhook (if URL configured)
      A4-->>O: RunSummary
      O->>DB: updateRunStatus (COMPLETED or REQUIRES_REVIEW)
      O-->>U: Final Pipeline Summary & Dashboard Update
  ```

---

## 3. Required Course Concepts

* **Multi-agent system:** Implements **4 agents** coordinating sequentially. Coordination is managed by `runMeetingOrchestrator` in `lib/orchestrator.ts`.
* **Tools:** Uses Google Workspace MCP integration. Details:
  * `google_sheets_read`: Reads rows from column tracking ranges ([mcp/sheets.ts](file:///Users/naveen/Documents/meetingmind/mcp/sheets.ts#L35)).
  * `google_sheets_search`: Matches task descriptions fuzzy-style ([mcp/sheets.ts](file:///Users/naveen/Documents/meetingmind/mcp/sheets.ts#L78)).
  * `google_sheets_append`: Appends new tracking row ([mcp/sheets.ts](file:///Users/naveen/Documents/meetingmind/mcp/sheets.ts#L128)).
  * `google_sheets_update`: Syncs updated status and deadlines ([mcp/sheets.ts](file:///Users/naveen/Documents/meetingmind/mcp/sheets.ts#L168)).
  * `google_calendar_list_events`: Pulls events to analyze overlaps ([mcp/calendar.ts](file:///Users/naveen/Documents/meetingmind/mcp/calendar.ts#L12)).
  * `google_calendar_create_event`: Creates calendar blockers ([mcp/calendar.ts](file:///Users/naveen/Documents/meetingmind/mcp/calendar.ts#L110)).
* **OpenAPI tools:** **NOT IMPLEMENTED**
* **Sessions & Memory:** Local memory is supported on the client with `zustand` ([lib/store.ts](file:///Users/naveen/Documents/meetingmind/lib/store.ts)), tracking the stepper state (`activeStep` 0 to 5) and transaction runs.
* **Long-term memory:** Supported via a local SQLite database (`meetingmind.db` using `bun:sqlite` in [lib/db.ts](file:///Users/naveen/Documents/meetingmind/lib/db.ts)). Includes tables for runs, action items, step logs, simulated sheets, and mock calendar events. Supabase support is fully implemented as a cloud remote fallback.
* **Context engineering:** **NOT IMPLEMENTED** (Transcripts are processed whole).
* **Observability:** Rich diagnostic step logging. Logs are categorized as `INFO`, `WARNING`, or `ERROR` and saved via `saveLog()` to SQLite. These logs are streamed dynamically to the developer terminal UI console.
* **Agent evaluation:** **NOT IMPLEMENTED**
* **A2A protocol:** **NOT IMPLEMENTED**
* **Agent deployment:** **NOT IMPLEMENTED**

---

## 4. MCP Integration

* **MCP Servers:** `@modelcontextprotocol/server-google-workspace`
* **MCP Client Configuration:** Defined in [mcp/client.ts](file:///Users/naveen/Documents/meetingmind/mcp/client.ts) and configured using stdio transport:
  ```json
  {
    "mcpServers": {
      "google-workspace": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-google-workspace"],
        "env": {
          "GOOGLE_OAUTH_CLIENT_ID": "${GOOGLE_OAUTH_CLIENT_ID}",
          "GOOGLE_OAUTH_CLIENT_SECRET": "${GOOGLE_OAUTH_CLIENT_SECRET}",
          "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth/callback",
          "SHEETS_SPREADSHEET_ID": "${SHEETS_SPREADSHEET_ID}"
        }
      }
    }
  }
  ```
* **Mock vs Real Integration:** Real API calls are executed if client secret environment variables are loaded in `.env.local`. If connection fails or variables are absent, the application catches the error and falls back to **simulated SQLite tables** (`mock_sheets` and `mock_calendar`), ensuring full local execution for testing.

---

## 5. Security & Guardrails

* **Confidence Thresholds:** 
  * Extractor flags any item with `extraction_confidence < 0.6`.
  * Auto-Commit Gate: Items are blocked from auto-creation/update unless they meet:
    ```typescript
    const meetsAutoCommit = 
      item.extraction_confidence >= 0.85 && 
      !item.calendar_conflict && 
      !!item.owner_resolved && 
      !item.needs_review;
    ```
* **Human-in-the-loop (HITL):** If `meetsAutoCommit` is false, `action_taken` is set to `FLAG_FOR_HUMAN`. This pushes the item to the Review Queue (`app/review/page.tsx`), requiring the user to edit/approve it before it writes to Sheets/Calendar.
* **Input Sanitization:** Regex date validation (`/^\d{4}-\d{2}-\d{2}$/`) is enforced via Zod schema refinement on deadlines.

---

## 6. Decision Logic

The agent makes autonomous scheduling choices using the following rules in `agents/resolver.ts`:

```typescript
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
```

---

## 7. Data Flow (Full Pipeline Trace)

* **Step 1: Input**
  * The user inputs a transcript (e.g. from the Q3 Launch Sync demo script) on the frontend.
* **Step 2: Extractor Processing**
  * The Extractor parses the text using Gemini, outputting JSON with extracted fields and confidence scores.
* **Step 3: Cross-Checking & Enrichment**
  * The Cross-Checker maps owner names to emails using a local lookup map (e.g., `Neha` $\rightarrow$ `neha@company.com`).
  * It queries the spreadsheet for duplicates and calendar events for conflicts on the scheduled day.
* **Step 4: Resolution & Write Commit**
  * High-confidence items (e.g., `Neha`'s landing page task) are auto-committed. The database/sheets are updated, and calendar invites are generated.
  * Conflicting items (e.g., `Arjun`'s scheduling conflict) or unassigned tasks (e.g., `UNKNOWN` owners) are flagged.
* **Step 5: Output & Reporting**
  * The Reporter prints execution summaries to the console, formats a Slack message, dispatches it to a Slack webhook (if configured), and updates the dashboard.

---

## 8. Tech Stack

* **Framework:** Next.js (Version `16.2.9` with App Router).
* **Language:** TypeScript.
* **Frontend:** TailwindCSS (`^4.0.0`), Zustand (`^5.0.14`), `lucide-react` for dashboard icons.
* **Database:** SQLite (`bun:sqlite` with local file `meetingmind.db`) / Supabase Postgres client.
* **Core Dependencies:**
  * `@google/genai` (Gemini API Integration)
  * `@modelcontextprotocol/sdk` (MCP Server-Client bindings)
  * `@supabase/supabase-js` (Supabase Integrations)
  * `zod` (Validation schemas)

---

## 9. Demo & Artifacts

* **Working Demo:** Runs locally on port `3000`.
* **YouTube Video / GitHub Repo:** N/A — not implemented.
* **Sample Input Transcript:**
  ```text
  Priya: We need to finalize the landing page copy by end of this week — Neha, can you own that?
  Neha: Sure, I'll have it done by Friday.
  Arjun: I'll send the revised pricing deck to the sales team by July 4th.
  Naveen: The API integration with Stripe should be wrapped up before the launch — I'm targeting July 3rd.
  Priya: Also Arjun, don't forget you already have the investor call prep due July 4th — make sure the deck doesn't conflict.
  Naveen: We should probably think about setting up monitoring at some point.
  Priya: Yeah, someday. Not blocking launch.
  ```
* **Gemini API Integration:** Invoked in [agents/extractor.ts](file:///Users/naveen/Documents/meetingmind/agents/extractor.ts#L131) to perform structured extraction using `gemini-2.5-flash`.
* **Cloud Run / Hosting:** N/A — not implemented.

---

## 10. Code Quality

* **Total Lines of Code:** ~3,500 lines.
* **Number of Files:** 38 files.
* **Tests:** **N/A — not implemented.**
* **Error Handling:** Full try/catch wrappers in Next.js API endpoints (`app/api/*/route.ts`) and the pipeline orchestrator. Errors are logged directly to the database with `log_level = 'ERROR'` and render gracefully on the client without breaking the execution stepper.

---

## 11. Known Limitations

* **What is Mocked vs Real:** Team email mapping is currently hardcoded inside `IDENTITY_MAP` within the Cross-Checker. 
* **Bypassed Integrations:** The MCP Workspace client operates in fallback mock mode if OAuth credentials are not specified, falling back to local database simulation tables.
* **Proposed Improvements:** Dynamic directory sync (linking email lookups directly to an address book database rather than a static map), audio transcription (direct Whisper/Gemini audio file processing), and automated integration testing via Jest or Playwright.
