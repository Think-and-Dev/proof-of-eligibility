"use client";

import React from "react";

export function DarkCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={
        "relative w-full rounded-2xl bg-slate-950/80 border border-sky-500/40 shadow-[0_0_40px_rgba(56,189,248,0.3)] " +
        "backdrop-blur-sm " +
        className
      }
    >
      <div className="relative p-5 md:p-6">{children}</div>
    </section>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
) {
  const { className = "", loading, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={
        "inline-flex items-center justify-center rounded-xl bg-sky-500 hover:bg-sky-400 " +
        "disabled:bg-sky-500/60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium " +
        "text-slate-950 shadow-lg shadow-sky-500/40 transition-colors " +
        className
      }
    >
      {loading && (
        <span className="mr-2 h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

export function StepHeader({
  currentStep,
  totalSteps,
  label,
}: {
  currentStep: number;
  totalSteps: number;
  label: string;
}) {
  const pct = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-xs md:text-sm text-slate-100 mb-2">
        <span className="font-medium">Step {currentStep} of {totalSteps}</span>
        <span className="text-slate-300">{label}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
