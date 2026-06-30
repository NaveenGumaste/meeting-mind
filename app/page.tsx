"use client";

import { useEffect, useState, useRef } from "react";
import { useAppStore } from "../lib/store";
import TranscriptInput from "../components/TranscriptInput";
import PipelineSteps from "../components/PipelineSteps";
import ActionItemTable from "../components/ActionItemTable";
import ConflictPanel from "../components/ConflictPanel";
import SummaryCard from "../components/SummaryCard";
import { ResolvedActionItem } from "../lib/schemas";
import { 
  Brain, FileSpreadsheet, CalendarRange, Terminal, Settings, LayoutDashboard,
  ClipboardList, RefreshCw, Layers, CheckCircle2, AlertTriangle, AlertCircle, Play, Info, ShieldAlert
} from "lucide-react";

type TabType = "dashboard" | "review" | "sheets" | "calendar" | "settings";

export default function Home() {
  const {
    runs,
    sheets,
    calendar,
    currentRunId,
    actionItems,
    logs,
    activeStep,
    activeSummary,
    fetchHistory,
    setCurrentRunId,
    clearCurrentRun,
    resetDatabase,
    loading
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [selectedItem, setSelectedItem] = useState<ResolvedActionItem | null>(null);
  const [logFilter, setLogFilter] = useState<"ALL" | "INFO" | "WARNING" | "ERROR">("ALL");
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Load database on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle log auto-scroll
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  }, [logs]);

  // Clear conflict panel selection if item gets approved
  useEffect(() => {
    if (selectedItem) {
      const current = actionItems.find(i => i.id === selectedItem.id);
      if (current && current.action_taken !== "FLAG_FOR_HUMAN") {
        setSelectedItem(null);
      }
    }
  }, [actionItems, selectedItem]);

  // Aggregate pending items in review queue
  const pendingReviewItems = sheets.filter(s => s.status === "Flagged" || actionItems.some(ai => ai.id === s.id && ai.action_taken === "FLAG_FOR_HUMAN"));
  const reviewQueueCount = pendingReviewItems.length;

  const filteredLogs = logs.filter(log => {
    if (logFilter === "ALL") return true;
    return log.log_level === logFilter;
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      
      {/* 1. Left Sidebar Navigation */}
      <aside className="w-64 bg-zinc-900/50 border-r border-zinc-800 flex flex-col justify-between p-4 flex-shrink-0 z-40 backdrop-blur-md">
        <div className="flex flex-col gap-8">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-zinc-700 via-zinc-800 to-zinc-900 flex items-center justify-center shadow-lg shadow-zinc-950/40">
              <Brain className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1">
                MeetingMind
                <span className="text-[8px] bg-zinc-800 text-zinc-300 border border-zinc-700 px-1 py-0.5 rounded">
                  MCP
                </span>
              </h1>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">Multi-Agent System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            <button
              onClick={() => { setActiveTab("dashboard"); setSelectedItem(null); }}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === "dashboard"
                  ? "bg-zinc-800/40 border-l-2 border-l-zinc-400 text-white font-extrabold shadow-sm shadow-black/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/40"
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5 text-zinc-400" />
              Agent Dashboard
            </button>

            <button
              onClick={() => { setActiveTab("review"); setSelectedItem(null); }}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === "review"
                  ? "bg-zinc-800/40 border-l-2 border-l-zinc-400 text-white font-extrabold shadow-sm shadow-black/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/40"
              }`}
            >
              <span className="flex items-center gap-3">
                <ClipboardList className="w-4.5 h-4.5 text-amber-400" />
                Review Queue
              </span>
              {reviewQueueCount > 0 && (
                <span className="bg-amber-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                  {reviewQueueCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("sheets")}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === "sheets"
                  ? "bg-zinc-800/40 border-l-2 border-l-zinc-400 text-white font-extrabold shadow-sm shadow-black/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/40"
              }`}
            >
              <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" />
              Spreadsheet Sim
            </button>

            <button
              onClick={() => setActiveTab("calendar")}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === "calendar"
                  ? "bg-zinc-800/40 border-l-2 border-l-zinc-400 text-white font-extrabold shadow-sm shadow-black/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-950/40"
              }`}
            >
              <CalendarRange className="w-4.5 h-4.5 text-zinc-400" />
              Calendar Sim
            </button>
          </nav>
        </div>

        {/* Database Quick Reset Control */}
        <div className="flex flex-col gap-3 bg-zinc-950/30 p-3 rounded-2xl border border-zinc-800/80">
          <div className="flex justify-between items-center text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Mock DB Active
            </span>
            <button
              onClick={resetDatabase}
              title="Reset databases to initial state"
              className="p-1 hover:bg-zinc-800 rounded text-slate-500 hover:text-slate-300 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-slate-500 leading-normal">
            SQLite database stores execution logs, Sheets simulation rows, and Calendar events.
          </p>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header Panel */}
        <header className="h-16 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between px-8 backdrop-blur-sm z-30">
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              {activeTab === "dashboard" && "Agent Orchestration Workspace"}
              {activeTab === "review" && "Human Verification Queue"}
              {activeTab === "sheets" && "Simulated Google Sheets database"}
              {activeTab === "calendar" && "Simulated Google Calendar Schedules"}
            </h2>
          </div>
          
          {/* Active Status indicators */}
          <div className="flex items-center gap-4 text-xs">
            {currentRunId && (
              <span className="text-[10px] font-mono text-slate-500">
                ACTIVE_RUN_ID: {currentRunId.slice(0, 8)}...
              </span>
            )}
            <span className="flex items-center gap-1.5 bg-zinc-900/80 px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-bold text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              Gemini model Active
            </span>
          </div>
        </header>

        {/* Pipeline Stepper Breadcrumb Row */}
        {currentRunId && (
          <div className="bg-zinc-900/5 border-b border-zinc-800 px-8 py-3.5 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center justify-between w-full max-w-7xl">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Current Run Status</span>
                <span className="text-xs font-bold text-slate-200 mt-0.5">{runs.find(r => r.id === currentRunId)?.meeting_title || "Meeting sync"}</span>
              </div>
              <PipelineSteps />
            </div>
          </div>
        )}

        {/* Tab contents viewport */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6">
          
          {/* ==================== DASHBOARD TAB ==================== */}
          {activeTab === "dashboard" && (
            <div className="flex flex-col gap-6 w-full">
              
              {/* Top Section Grid (Inputs & Stepper Info) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                
                {/* Left columns (4 Cols): Inputs and History */}
                <div className="xl:col-span-4 flex flex-col gap-6 h-full">
                  <TranscriptInput />
                </div>

                {/* Right columns (8 Cols): Agents, Console */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                  
                  {/* Visualizer and console triggers if runId active */}
                  {!currentRunId ? (
                    <div className="glass-panel rounded-2xl p-16 text-center flex flex-col items-center justify-center min-h-[460px] border border-zinc-800">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-zinc-850 to-zinc-900 border border-zinc-700/50 flex items-center justify-center mb-6 animate-pulse">
                        <Brain className="w-7 h-7 text-zinc-400" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-100">Ready to Orchestrate</h3>
                      <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed font-sans">
                        Select a historical run from the left panel or paste a transcript to watch the multi-agent system process it step-by-step.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      
                      {/* Stepper details */}

                      {/* SummaryCard card */}
                      {activeSummary && <SummaryCard summary={activeSummary} />}

                      {/* Developer Terminal Console Log */}
                      <div className="glass-panel rounded-2xl overflow-hidden border border-zinc-800">
                        
                        {/* Terminal header */}
                        <div className="px-5 py-3 border-b border-zinc-800/85 bg-zinc-950/60 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1.5">
                              <span className="w-3 h-3 rounded-full bg-zinc-700/80" />
                              <span className="w-3 h-3 rounded-full bg-zinc-650/80" />
                              <span className="w-3 h-3 rounded-full bg-zinc-600/80" />
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 ml-2">meetingmind@mcp:~ console</span>
                          </div>

                          {/* Console filters */}
                          <div className="flex gap-1">
                            {(["ALL", "INFO", "WARNING", "ERROR"] as const).map((filter) => (
                              <button
                                key={filter}
                                onClick={() => setLogFilter(filter)}
                                className={`text-[9px] font-bold px-2 py-1 rounded-md transition-colors ${
                                  logFilter === filter
                                    ? "bg-zinc-800 text-white border border-zinc-700"
                                    : "text-slate-500 hover:text-slate-300"
                                }`}
                              >
                                {filter}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Log output stream */}
                        <div
                          ref={logContainerRef}
                          className="bg-slate-950/90 h-[160px] overflow-y-auto p-4 flex flex-col gap-2 font-mono text-[10px] leading-relaxed select-text"
                        >
                          {filteredLogs.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-slate-600 italic">
                              No logs matching filter selection.
                            </div>
                          ) : (
                            filteredLogs.map((log) => {
                              const isWarning = log.log_level === "WARNING";
                              const isError = log.log_level === "ERROR";
                              
                              return (
                                <div
                                  key={log.id}
                                  className={`flex items-start gap-2.5 p-1 rounded transition-colors ${
                                    isWarning
                                      ? "bg-amber-500/5 text-amber-300/90"
                                      : isError
                                      ? "bg-rose-500/5 text-rose-300/90"
                                      : "text-slate-300"
                                  }`}
                                >
                                  <span className="text-[9px] text-slate-500 select-none">
                                    {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                                  </span>
                                  <span className={`font-bold select-none ${
                                    log.agent_name === "EXTRACTOR"
                                      ? "text-zinc-300"
                                      : log.agent_name === "CROSS_CHECKER"
                                      ? "text-zinc-400"
                                      : log.agent_name === "RESOLVER"
                                      ? "text-zinc-500"
                                      : "text-zinc-150"
                                  }`}>
                                    [{log.agent_name}]
                                  </span>
                                  <span className="flex-1 whitespace-pre-wrap">{log.message}</span>
                                </div>
                              );
                            })
                          )}
                          {loading && (
                            <div className="flex items-center gap-1.5 py-0.5 text-zinc-400 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-ping" />
                              <span>Agent pipeline running... querying MCP models...</span>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                </div>

              </div>

              {/* Bottom Section (Full Width): Action Items List with Inline override drawer */}
              {currentRunId && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
                  
                  {/* Left: Deliverables table (grows full-width when no items selected) */}
                  <div className={`${selectedItem ? "lg:col-span-7" : "lg:col-span-12"} transition-all duration-300`}>
                    <ActionItemTable
                      items={actionItems}
                      onSelectItem={(item) => setSelectedItem(item.action_taken === "FLAG_FOR_HUMAN" ? item : null)}
                      selectedItemId={selectedItem?.id}
                    />
                  </div>

                  {/* Right: override panel if selected */}
                  {selectedItem && (
                    <div className="lg:col-span-5 animate-in slide-in-from-right duration-350">
                      <ConflictPanel
                        item={selectedItem}
                        onClose={() => setSelectedItem(null)}
                      />
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* ==================== REVIEW TAB ==================== */}
          {activeTab === "review" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Flagged items queue list (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/35">
                  <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <h3 className="text-sm font-semibold text-slate-200">Pending Review Queue ({reviewQueueCount})</h3>
                    </div>
                  </div>

                  {pendingReviewItems.length === 0 ? (
                    <div className="p-16 flex flex-col items-center justify-center text-center">
                      <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4 animate-bounce" />
                      <p className="text-sm font-semibold text-slate-200">Review Queue Clear!</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                        All extracted action items have been autonomously resolved or committed successfully.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-slate-850">
                      {/* Check matching items in current action items or database sheets rows */}
                      {actionItems.filter(item => item.action_taken === "FLAG_FOR_HUMAN").map((item) => {
                        const isSelected = selectedItem?.id === item.id;
                        
                        return (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className={`p-5 cursor-pointer hover:bg-slate-950/30 transition-colors flex flex-col gap-3 relative ${
                              isSelected ? "bg-zinc-800/20 border-l-2 border-l-zinc-400" : ""
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="text-sm font-semibold text-slate-100">{item.task}</h4>
                              <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded font-bold uppercase">
                                Action Flagged
                              </span>
                            </div>

                            <p className="text-xs text-amber-400 bg-amber-500/5 p-3 rounded-lg border border-amber-500/10 leading-relaxed flex gap-2">
                              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <span>{item.reason}</span>
                            </p>

                            <div className="flex gap-4 text-[10px] text-slate-400 font-sans">
                              <span>Owner: <strong className="text-slate-300">{item.owner}</strong></span>
                              <span>Deadline: <strong className="text-slate-300">{item.deadline || "None"}</strong></span>
                              <span>Confidence: <strong className="text-slate-300">{Math.round(item.extraction_confidence * 100)}%</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution settings details card (5 Cols) */}
              <div className="lg:col-span-5">
                {selectedItem ? (
                  <ConflictPanel
                    item={selectedItem}
                    onClose={() => setSelectedItem(null)}
                  />
                ) : (
                  <div className="glass-panel rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] border border-slate-800 bg-slate-900/10">
                    <ShieldAlert className="w-8 h-8 text-slate-600 mb-3" />
                    <p className="text-xs font-semibold text-slate-400">Select flagged item for review</p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">Select a task on the left to edit and commit parameters.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ==================== SPREADSHEET SIM TAB ==================== */}
          {activeTab === "sheets" && (
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 flex flex-col">
              
              {/* Spreadsheet headers */}
              <div className="px-6 py-4 bg-slate-900/70 border-b border-slate-850 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Google Sheet - Client Tracker</h3>
                    <p className="text-[10px] text-slate-500 font-mono">active_sheet_id: {process.env.SHEETS_SPREADSHEET_ID || "meetingmind_simulate"}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className="bg-slate-950 text-slate-400 border border-slate-850 px-3 py-1 rounded-lg text-[10px] font-bold font-mono">
                    ROWS_COUNT: {sheets.length}
                  </span>
                </div>
              </div>

              {/* Grid cell matrix */}
              <div className="overflow-x-auto select-text">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/40 text-slate-400 font-bold uppercase border-b border-slate-850 select-none text-[10px] tracking-wider">
                      <th className="py-3 px-4 border-r border-slate-900 w-16 text-center">Row</th>
                      <th className="py-3 px-4 border-r border-slate-900">Task Title</th>
                      <th className="py-3 px-4 border-r border-slate-900">Assigned Owner</th>
                      <th className="py-3 px-4 border-r border-slate-900">Owner Email</th>
                      <th className="py-3 px-4 border-r border-slate-900">Deadline Target</th>
                      <th className="py-3 px-4 text-right">Commit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-200">
                    {sheets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                          No tasks recorded in sheets database. Run a pipeline to populate values.
                        </td>
                      </tr>
                    ) : (
                      sheets.map((row, index) => (
                        <tr key={row.id} className="hover:bg-slate-900/10">
                          <td className="py-3 px-4 border-r border-slate-900 text-center font-mono text-slate-500 bg-slate-950/10">
                            {index + 1}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-900 font-semibold text-slate-100">
                            {row.task}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-900 font-medium text-slate-300">
                            {row.owner}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-900 font-mono text-[10px] text-slate-400">
                            {row.owner_resolved || "n/a"}
                          </td>
                          <td className="py-3 px-4 border-r border-slate-900 text-slate-300">
                            {row.deadline || "None"}
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                              row.status === "Complete"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ==================== CALENDAR SIM TAB ==================== */}
          {activeTab === "calendar" && (
            <div className="glass-panel rounded-2xl p-6 border border-zinc-800 flex flex-col gap-6">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 bg-slate-900/10 p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <CalendarRange className="w-5 h-5 text-zinc-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Google Calendar Schedule Logs</h3>
                    <p className="text-[10px] text-slate-500 font-mono">Simulated workspace agenda schedules</p>
                  </div>
                </div>
              </div>

              {/* Timelines grid list */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {calendar.map((event) => (
                  <div
                    key={event.id}
                    className="bg-slate-950/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-zinc-500" />
                    
                    <div className="flex flex-col gap-1 pl-2">
                      <span className="text-[9px] font-bold font-mono text-zinc-400 uppercase tracking-wider">
                        Calendar ID: {event.owner_resolved}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200 leading-normal">{event.title}</h4>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-900 pt-2.5 pl-2 text-[10px] text-slate-400 font-sans">
                      <span>Schedule:</span>
                      <span className="font-semibold text-slate-300 font-mono">{event.start_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
