"use client";

import { CheckCircle2, AlertCircle, PlusCircle, RefreshCw, Send, Check } from "lucide-react";

interface SummaryCardProps {
  summary: {
    meeting_title: string;
    total_extracted: number;
    created: number;
    updated: number;
    flagged: number;
    skipped: number;
    summary_text: string;
    slack_sent: boolean;
  };
}

export default function SummaryCard({ summary }: SummaryCardProps) {
  return (
    <div className="glass-panel rounded-2xl p-6 glow-card-gray flex flex-col gap-5 border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Pipeline Execution Complete
        </h3>
        <span
          className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
            summary.slack_sent
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-slate-500/10 text-slate-400 border-slate-800"
          }`}
        >
          <Send className="w-3 h-3" />
          Slack: {summary.slack_sent ? "Dispatched" : "Skipped"}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-3">
        {/* Total Extracted */}
        <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-slate-100">{summary.total_extracted}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Extracted</span>
        </div>
        {/* New Added */}
        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-emerald-400">{summary.created}</span>
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mt-1">Added</span>
        </div>
        {/* Updated */}
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-blue-400">{summary.updated}</span>
          <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mt-1">Updated</span>
        </div>
        {/* Flagged */}
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3.5 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold text-amber-400">{summary.flagged}</span>
          <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mt-1">Flagged</span>
        </div>
      </div>

      {/* Markdown Text Area */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">slack summary notification preview</label>
        <pre className="bg-slate-950/65 border border-slate-800 rounded-xl p-4 text-[10px] font-mono text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
          {summary.summary_text}
        </pre>
      </div>
    </div>
  );
}
