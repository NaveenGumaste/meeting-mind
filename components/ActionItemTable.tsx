"use client";

import { ResolvedActionItem } from "../lib/schemas";
import { ShieldCheck, UserCheck, Calendar, ArrowRight, Hourglass } from "lucide-react";

interface ActionItemTableProps {
  items: ResolvedActionItem[];
  onSelectItem?: (item: ResolvedActionItem) => void;
  selectedItemId?: string | null;
}

export default function ActionItemTable({ items, onSelectItem, selectedItemId }: ActionItemTableProps) {
  if (items.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center text-center border border-dashed border-slate-800">
        <Hourglass className="w-10 h-10 text-slate-500 animate-pulse mb-3" />
        <p className="text-sm font-semibold text-slate-400">No action items processed yet.</p>
        <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Paste a transcript and run MeetingMind to see extracted deliverables.</p>
      </div>
    );
  }

  const getStatusBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Auto Created
          </span>
        );
      case "UPDATE":
        return (
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Row Updated
          </span>
        );
      case "SKIP":
        return (
          <span className="bg-slate-500/10 text-slate-400 border border-slate-800 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Skipped (Dup)
          </span>
        );
      case "FLAG_FOR_HUMAN":
        return (
          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Flagged Review
          </span>
        );
      default:
        return null;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return "bg-emerald-500 text-emerald-400";
    if (score >= 0.6) return "bg-amber-500 text-amber-400";
    return "bg-rose-500 text-rose-400";
  };

  return (
    <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
      <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/35">
        <h3 className="text-sm font-semibold text-slate-200">Extracted Deliverables</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-800/60 bg-slate-950/20 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3">Task Details</th>
              <th className="px-6 py-3">Responsible Owner</th>
              <th className="px-6 py-3">Deadline</th>
              <th className="px-6 py-3 text-center">Confidence</th>
              <th className="px-6 py-3 text-right">Pipeline Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40 text-xs">
            {items.map((item) => {
              const isSelected = selectedItemId === item.id;
              
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectItem?.(item)}
                  className={`hover:bg-slate-900/30 transition-colors cursor-pointer ${
                    isSelected ? "bg-zinc-800/20 border-l-2 border-l-zinc-400" : ""
                  }`}
                >
                  {/* Task details */}
                  <td className="px-6 py-4 font-medium text-slate-100 max-w-[280px]">
                    <div className="flex flex-col gap-1">
                      <span className="truncate block font-semibold text-slate-200">{item.task}</span>
                      <span className="text-[10px] text-slate-400 font-mono italic truncate block">
                        "{item.source_quote}"
                      </span>
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {item.owner_resolved ? (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.owner}</span>
                          <span className="text-[9px] text-slate-500">{item.owner_resolved}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                        {item.owner || "UNKNOWN"}
                      </span>
                    )}
                  </td>

                  {/* Deadline */}
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300 font-medium">
                    {item.deadline ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <div className="flex flex-col">
                          <span>{item.deadline}</span>
                          <span className="text-[9px] text-slate-500 font-mono capitalize">
                            {item.deadline_confidence}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>

                  {/* Confidence bar */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col items-center gap-1 w-20 mx-auto">
                      <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full ${getConfidenceColor(item.extraction_confidence).split(" ")[0]}`}
                          style={{ width: `${item.extraction_confidence * 100}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${getConfidenceColor(item.extraction_confidence).split(" ")[1]}`}>
                        {Math.round(item.extraction_confidence * 100)}%
                      </span>
                    </div>
                  </td>

                  {/* Action Status */}
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {getStatusBadge(item.action_taken)}
                      {onSelectItem && item.action_taken === "FLAG_FOR_HUMAN" && (
                        <ArrowRight className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
