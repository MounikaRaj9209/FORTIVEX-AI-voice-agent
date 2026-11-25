import React from "react";

const VARIANT_MAP: Record<string, string> = {
  // Sentiments
  Positive: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  Neutral: "bg-slate-100 text-slate-600 border-slate-200/80",
  Negative: "bg-rose-50 text-rose-700 border-rose-200/80",
  // Intent & Priority
  "High intent": "bg-blue-50 text-blue-700 border-blue-200/80",
  "Medium intent": "bg-amber-50 text-amber-700 border-amber-200/80",
  "Low intent": "bg-slate-100 text-slate-600 border-slate-200/80",
  Hot: "bg-rose-50 text-rose-700 border-rose-200/80",
  Warm: "bg-amber-50 text-amber-700 border-amber-200/80",
  Cold: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
  // Lead & Appointment Statuses
  New: "bg-sky-50 text-sky-700 border-sky-200/80",
  Contacted: "bg-blue-50 text-blue-700 border-blue-200/80",
  Qualified: "bg-teal-50 text-teal-700 border-teal-200/80",
  Interested: "bg-cyan-50 text-cyan-700 border-cyan-200/80",
  "Appointment Scheduled": "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  Converted: "bg-emerald-100 text-emerald-800 border-emerald-300/80",
  Lost: "bg-rose-50 text-rose-700 border-rose-200/80",
  Scheduled: "bg-teal-50 text-teal-700 border-teal-200/80",
  Completed: "bg-blue-50 text-blue-700 border-blue-200/80",
  Cancelled: "bg-slate-100 text-slate-500 border-slate-200/80",
};

export function StatusBadge({ value }: { value: string }) {
  const cls = VARIANT_MAP[value] || "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold tracking-tight border ${cls}`}
    >
      {value}
    </span>
  );
}
