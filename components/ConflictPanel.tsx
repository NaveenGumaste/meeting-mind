"use client";

import { useState, useEffect } from "react";
import { ResolvedActionItem } from "../lib/schemas";
import { useAppStore } from "../lib/store";
import { AlertTriangle, CheckCircle, Check, X, ShieldAlert, ArrowRight } from "lucide-react";

interface ConflictPanelProps {
  item: ResolvedActionItem;
  onClose?: () => void;
}

export default function ConflictPanel({ item, onClose }: ConflictPanelProps) {
  const { approveFlaggedItem, loading } = useAppStore();
  const [task, setTask] = useState(item.task);
  const [owner, setOwner] = useState(item.owner);
  const [email, setEmail] = useState(item.owner_resolved || "");
  const [deadline, setDeadline] = useState(item.deadline || "");
  const [overrideAction, setOverrideAction] = useState<"CREATE" | "UPDATE" | "SKIP">("CREATE");

  // Keep state sync'd if selected item changes
  useEffect(() => {
    setTask(item.task);
    setOwner(item.owner);
    setEmail(item.owner_resolved || "");
    setDeadline(item.deadline || "");
    setOverrideAction(item.duplicate_of ? "UPDATE" : "CREATE");
  }, [item]);

  const handleApprove = async () => {
    const editedFields: Partial<ResolvedActionItem> = {
      task,
      owner,
      owner_resolved: email.trim() || null,
      deadline: deadline.trim() || null,
      action_taken: overrideAction,
    };

    // If it's a duplicate check override, map duplicate_of correctly
    if (overrideAction === "CREATE") {
      editedFields.duplicate_of = null;
    }

    await approveFlaggedItem(item.id, editedFields);
    if (onClose) onClose();
  };

  return (
    <div className="glass-panel rounded-2xl p-6 glow-card-gray border border-slate-700 flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-500 animate-bounce" />
          Resolve Flagged Task Conflict
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 hover:bg-slate-900 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Warning Box */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-xs text-amber-400 leading-relaxed">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
        <div className="flex flex-col gap-1">
          <span className="font-semibold uppercase tracking-wider text-[10px]">Reason for Gate Trigger:</span>
          <span>{item.reason}</span>
          <span className="text-[10px] text-slate-400 font-mono italic mt-1 bg-slate-950/40 p-2 rounded border border-slate-800/40">
            Quote: "{item.source_quote}"
          </span>
        </div>
      </div>

      {/* Editing Form */}
      <div className="flex flex-col gap-4">
        {/* Task description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Task Description</label>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            disabled={loading}
            className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Owner name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Owner Name</label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              disabled={loading}
              placeholder="e.g. Arjun"
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Owner resolved email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Resolved Identity Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              placeholder="e.g. arjun@company.com"
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Deadline */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deadline (YYYY-MM-DD)</label>
            <input
              type="text"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={loading}
              placeholder="YYYY-MM-DD"
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Routing Decision */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Action Route</label>
            <select
              value={overrideAction}
              onChange={(e) => setOverrideAction(e.target.value as any)}
              disabled={loading}
              className="bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="CREATE">Create New Task Entry</option>
              {item.duplicate_of && <option value="UPDATE">Update Existing Task Row</option>}
              <option value="SKIP">Skip / Discard Task</option>
            </select>
          </div>
        </div>
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-end gap-3 mt-2">
        {onClose && (
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-zinc-800/60 rounded-xl transition-colors border border-transparent hover:border-zinc-700"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleApprove}
          disabled={loading || !task.trim()}
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold py-2 px-5 rounded-xl text-xs flex items-center gap-1.5 transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          Approve & Commit
        </button>
      </div>
    </div>
  );
}
