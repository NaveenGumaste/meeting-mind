"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "../../lib/store";
import Link from "next/link";
import ConflictPanel from "../../components/ConflictPanel";
import { ResolvedActionItem } from "../../lib/schemas";
import { Brain, ArrowLeft, Hourglass, ShieldAlert, AlertTriangle, ArrowRight, User, Calendar, MessageSquare } from "lucide-react";

interface FlaggedItem extends ResolvedActionItem {
  run_title?: string;
  run_id?: string;
}

export default function ReviewPage() {
  const { sheets, calendar, fetchHistory } = useAppStore();
  
  // We'll query our API specifically for flagged items
  const [flaggedItems, setFlaggedItems] = useState<FlaggedItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<FlaggedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlagged = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/runs");
      if (!res.ok) throw new Error("Failed to fetch runs");
      const data = await res.json();
      
      // Look through runs to gather items flagged for human
      let items: any[] = [];
      const runHistory = data.runs || [];
      
      for (const run of runHistory) {
        const detailRes = await fetch(`/api/runs?runId=${run.id}`);
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const runItems = detailData.action_items || [];
          const runFlagged = runItems.filter((i: any) => i.action_taken === "FLAG_FOR_HUMAN");
          // Tag with run title for context
          items = [...items, ...runFlagged.map((i: any) => ({ ...i, run_title: run.meeting_title, run_id: run.id }))];
        }
      }

      setFlaggedItems(items);
      
      // Auto-select first item if none selected or selected item is no longer flagged
      if (items.length > 0) {
        if (!selectedItem || !items.some(i => i.id === selectedItem.id)) {
          setSelectedItem(items[0]);
        }
      } else {
        setSelectedItem(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchFlagged();
  }, [fetchHistory]);

  const handleResolveSuccess = () => {
    fetchFlagged();
    fetchHistory();
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass-panel border-b border-slate-800/80 px-6 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-zinc-700 via-zinc-800 to-zinc-900 flex items-center justify-center shadow-lg shadow-zinc-950/40">
              <Brain className="w-5 h-5 text-zinc-200" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-white flex items-center gap-1.5">
                MeetingMind
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Review Queue
                </span>
              </h1>
              <p className="text-[10px] text-slate-400 font-medium">Human-in-the-loop Resolution Panel</p>
            </div>
          </div>

          <Link
            href="/"
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col gap-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Flagged Queue List (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
              <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/35 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-200">Pending Review Queue ({flaggedItems.length})</h3>
                <button
                  onClick={fetchFlagged}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  Refresh Queue
                </button>
              </div>

              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <span className="w-8 h-8 border-2 border-cyan-500/25 border-t-cyan-400 rounded-full animate-spin mb-3" />
                  <p className="text-xs text-slate-400">Loading flagged action items...</p>
                </div>
              ) : flaggedItems.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <Hourglass className="w-10 h-10 text-slate-600 mb-3" />
                  <p className="text-sm font-semibold text-slate-400">All caught up! No flagged items.</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                    Tasks with confidence &gt; 85% and no calendar or identity conflicts are automatically committed.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-850">
                  {flaggedItems.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className={`p-5 cursor-pointer hover:bg-slate-900/35 transition-colors flex flex-col gap-3 relative ${
                          isSelected ? "bg-zinc-800/20 border-l-2 border-l-zinc-400" : ""
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                              Origin: {item.run_title || "Meeting"}
                            </span>
                            <span className="text-sm font-semibold text-slate-100">{item.task}</span>
                          </div>
                          
                          <ArrowRight className={`w-4 h-4 text-zinc-400 transition-transform ${
                            isSelected ? "translate-x-1" : "opacity-0"
                          }`} />
                        </div>

                        {/* Reason Banner */}
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                          <span className="truncate">{item.reason}</span>
                        </div>

                        {/* Owner & Deadline row */}
                        <div className="flex gap-4 text-[10px] text-slate-400 font-sans">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            Owner: <span className="font-semibold text-slate-300">{item.owner}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            Deadline: <span className="font-semibold text-slate-300">{item.deadline || "None"}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            Confidence: <span className="font-semibold text-slate-300">{Math.round(item.extraction_confidence * 100)}%</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Resolution Panel (5 Cols) */}
          <div className="lg:col-span-5">
            {selectedItem ? (
              <ConflictPanel
                item={selectedItem}
                onClose={handleResolveSuccess}
              />
            ) : (
              <div className="glass-panel rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[300px] border border-slate-800 bg-slate-900/10">
                <ShieldAlert className="w-8 h-8 text-slate-600 mb-3" />
                <p className="text-xs font-semibold text-slate-400">Select an item from the queue</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">Select a task on the left to edit and commit overrides.</p>
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}
