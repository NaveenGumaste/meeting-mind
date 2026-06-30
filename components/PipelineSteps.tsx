"use client";

import { useAppStore } from "../lib/store";
import { ChevronRight } from "lucide-react";

interface StepConfig {
  number: number;
  name: string;
}

const STEPS: StepConfig[] = [
  { number: 1, name: "Extractor" },
  { number: 2, name: "Cross-Checker" },
  { number: 3, name: "Resolver" },
  { number: 4, name: "Reporter" },
];

export default function PipelineSteps() {
  const { activeStep, loading } = useAppStore();

  // Custom SVGs
  const GreenCheck = () => (
    <svg className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="10" cy="10" r="8" className="fill-emerald-500/10 stroke-emerald-500/20" />
      <path d="M6.5 10.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const RedCross = () => (
    <svg className="w-4.5 h-4.5 text-rose-500 flex-shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="10" cy="10" r="8" className="fill-rose-500/10 stroke-rose-500/20" />
      <path d="M7 7l6 6M7 13l6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const LoadingSpinner = () => (
    <svg className="w-4.5 h-4.5 text-zinc-400 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <circle cx="12" cy="12" r="10" stroke="currentColor" className="stroke-zinc-850" />
      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="flex items-center gap-1 bg-zinc-950/40 border border-zinc-800 px-4 py-2 rounded-xl backdrop-blur-md">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-2 font-mono">
        Pipeline:
      </span>
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const isCompleted = activeStep > step.number;
          const isCurrent = activeStep === step.number;
          const isIdle = activeStep < step.number;

          return (
            <div key={step.number} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  isCurrent
                    ? "bg-zinc-800/40 border-zinc-750 text-zinc-300 ring-1 ring-zinc-700/10"
                    : isCompleted
                    ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-400"
                    : "bg-zinc-900/10 border-zinc-900/50 text-slate-500"
                }`}
              >
                {/* Custom status indicator */}
                {isCompleted && <GreenCheck />}
                {isCurrent && <LoadingSpinner />}
                {isIdle && <RedCross />}

                <span className={isCurrent ? "font-bold" : "font-semibold"}>
                  {step.name}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
