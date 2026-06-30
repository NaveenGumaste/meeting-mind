import { create } from "zustand";
import { ResolvedActionItem, RunLog } from "./schemas";
import { SheetTask } from "../mcp/sheets";
import { CalendarEvent } from "../mcp/calendar";

interface MeetingRun {
  id: string;
  meeting_title: string;
  raw_transcript: string;
  summary: string;
  status: string;
  created_at: string;
}

interface RunSummary {
  meeting_title: string;
  total_extracted: number;
  created: number;
  updated: number;
  flagged: number;
  skipped: number;
  summary_text: string;
  slack_sent: boolean;
}

interface AppState {
  runs: MeetingRun[];
  sheets: SheetTask[];
  calendar: CalendarEvent[];
  currentRunId: string | null;
  actionItems: ResolvedActionItem[];
  logs: RunLog[];
  activeStep: number; // 0: Idle, 1: Extract, 2: Cross-check, 3: Resolve, 4: Report, 5: Finished
  activeSummary: RunSummary | null;
  loading: boolean;
  error: string | null;

  fetchHistory: () => Promise<void>;
  fetchRunDetails: (runId: string) => Promise<void>;
  resetDatabase: () => Promise<void>;
  setCurrentRunId: (runId: string | null) => void;
  clearCurrentRun: () => void;
  executePipeline: (transcript: string, title: string) => Promise<void>;
  approveFlaggedItem: (itemId: string, editedFields?: Partial<ResolvedActionItem>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  runs: [],
  sheets: [],
  calendar: [],
  currentRunId: null,
  actionItems: [],
  logs: [],
  activeStep: 0,
  activeSummary: null,
  loading: false,
  error: null,

  fetchHistory: async () => {
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      set({
        runs: data.runs || [],
        sheets: data.sheets || [],
        calendar: data.calendar || [],
      });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  fetchRunDetails: async (runId: string) => {
    try {
      const res = await fetch(`/api/runs?runId=${runId}`);
      if (!res.ok) throw new Error("Failed to fetch run details");
      const data = await res.json();
      set({
        actionItems: data.action_items || [],
        logs: data.logs || [],
        sheets: data.sheets || [],
        calendar: data.calendar || [],
      });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  resetDatabase: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/mock/reset", { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset database");
      const data = await res.json();
      set({
        sheets: data.sheets || [],
        calendar: data.calendar || [],
        actionItems: [],
        logs: [],
        currentRunId: null,
        activeStep: 0,
        activeSummary: null,
      });
      await get().fetchHistory();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  setCurrentRunId: (runId: string | null) => {
    set({ currentRunId: runId, activeStep: runId ? 5 : 0, activeSummary: null });
    if (runId) {
      get().fetchRunDetails(runId);
    } else {
      set({ actionItems: [], logs: [] });
    }
  },

  clearCurrentRun: () => {
    set({
      currentRunId: null,
      actionItems: [],
      logs: [],
      activeStep: 0,
      activeSummary: null,
      error: null
    });
  },

  executePipeline: async (transcript: string, title: string) => {
    const runId = crypto.randomUUID();
    set({
      loading: true,
      error: null,
      currentRunId: runId,
      actionItems: [],
      logs: [],
      activeStep: 1,
      activeSummary: null,
    });

    try {
      const safeTitle = title.trim() || "Meeting launch checkpoint";
      
      // 1. EXTRACT STEP
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, runId, meeting_title: safeTitle }),
      });
      if (!extractRes.ok) throw new Error("Agent 1 (Extractor) failed during text extraction.");
      
      const extractData = await extractRes.json();
      set({ actionItems: extractData.action_items.map((i: any) => ({ ...i, action_taken: "CREATE", reason: "" })) });
      await get().fetchRunDetails(runId); // pull initial log entries

      // 2. CROSS-CHECK STEP
      set({ activeStep: 2 });
      const crossRes = await fetch("/api/cross-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_items: extractData.action_items, runId }),
      });
      if (!crossRes.ok) throw new Error("Agent 2 (Cross-checker) failed during validation audits.");
      
      const crossData = await crossRes.json();
      // Map enriched values back to client items view
      set({ actionItems: crossData.map((i: any) => ({ ...i, action_taken: "CREATE", reason: "" })) });
      await get().fetchRunDetails(runId);

      // 3. RESOLUTION STEP
      set({ activeStep: 3 });
      const resolveRes = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enriched_items: crossData,
          runId,
          meeting_summary: extractData.meeting_summary,
        }),
      });
      if (!resolveRes.ok) throw new Error("Agent 3 (Resolver) failed to execute commit judgment routing.");
      
      const resolveData = await resolveRes.json();
      set({ actionItems: resolveData.action_items });
      await get().fetchRunDetails(runId);

      // 4. REPORT STEP
      set({ activeStep: 4 });
      const reportRes = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_title: safeTitle,
          resolved_items: resolveData.action_items,
        }),
      });
      if (!reportRes.ok) throw new Error("Agent 4 (Reporter) failed to compile dispatch summary.");
      
      const reportData = await reportRes.json();
      set({ activeSummary: reportData, activeStep: 5 });
      
      // Reload overall workspace histories
      await get().fetchHistory();
      await get().fetchRunDetails(runId);
    } catch (e: any) {
      console.error(e);
      set({ error: e.message, activeStep: 0 });
    } finally {
      set({ loading: false });
    }
  },

  approveFlaggedItem: async (itemId: string, editedFields?: Partial<ResolvedActionItem>) => {
    const { currentRunId, actionItems } = get();
    if (!currentRunId) return;

    const item = actionItems.find(i => i.id === itemId);
    if (!item) return;

    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: currentRunId,
          itemId,
          item,
          editedFields,
        }),
      });

      if (!res.ok) throw new Error("Override execution failed.");
      
      // Refresh details and database states
      await get().fetchRunDetails(currentRunId);
      await get().fetchHistory();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },
}));
