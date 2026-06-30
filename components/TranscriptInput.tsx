"use client";

import { useState } from "react";
import { useAppStore } from "../lib/store";
import { Play, RotateCcw, FileText } from "lucide-react";

const SAMPLE_TRANSCRIPT = `Meeting: Q3 Launch Sync — June 30, 2026
Attendees: Priya, Arjun, Neha, Naveen

Priya: We need to finalize the landing page copy by end of this week — Neha, can you own that?
Neha: Sure, I'll have it done by Friday.

Arjun: I'll send the revised pricing deck to the sales team by July 4th.

Naveen: The API integration with Stripe should be wrapped up before the launch — I'm targeting July 3rd.

Priya: Also Arjun, don't forget you already have the investor call prep due July 4th — make sure the deck doesn't conflict.

Naveen: We should probably think about setting up monitoring at some point.
Priya: Yeah, someday. Not blocking launch.`;

export default function TranscriptInput() {
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("Q3 Launch Sync");
  const { executePipeline, resetDatabase, loading } = useAppStore();

  const handleLoadSample = () => {
    setTranscript(SAMPLE_TRANSCRIPT);
    setTitle("Q3 Launch Sync");
  };

  const handleRun = () => {
    if (!transcript.trim()) return;
    executePipeline(transcript, title);
  };

  return (
    <div className="glass-panel rounded-2xl p-6 glow-card-gray flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-zinc-400" />
          Input Transcript
        </h2>
        <button
          onClick={handleLoadSample}
          disabled={loading}
          className="text-xs font-medium text-zinc-300 hover:text-white transition-colors flex items-center gap-1 bg-zinc-800/60 px-2.5 py-1.5 rounded-lg border border-zinc-700 disabled:opacity-50"
        >
          Load Demo Script
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-400">Meeting Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={loading}
          placeholder="e.g. Q3 Launch Sync"
          className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-zinc-550 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2 flex-1 h-full min-h-[320px]">
        <label className="text-xs font-semibold text-slate-400 font-sans">Raw Transcript / Meeting Notes</label>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          disabled={loading}
          placeholder="Paste meeting transcript or raw discussion notes here..."
          className="w-full flex-1 h-full bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500/20 transition-all resize-none leading-relaxed"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRun}
          disabled={loading || !transcript.trim()}
          className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-zinc-950/40 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
              Running Agents...
            </span>
          ) : (
            <>
              <Play className="w-4 h-4 fill-zinc-950 text-zinc-950" />
              Run MeetingMind
            </>
          )}
        </button>
        
        <button
          onClick={resetDatabase}
          disabled={loading}
          title="Reset Sheets and Calendar simulation datasets"
          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-4 rounded-xl flex items-center justify-center transition-colors active:scale-[0.98]"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
