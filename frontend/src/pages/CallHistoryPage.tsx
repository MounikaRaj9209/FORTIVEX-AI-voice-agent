import React, { useEffect, useState } from "react";
import { FileText, MessageSquare, PhoneCall } from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { formatISTDateTime } from "../utils/format";
import type { CallRecord } from "../types";

export function CallHistoryPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selected, setSelected] = useState<CallRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCalls()
      .then((data) => {
        setCalls(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading call history...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white rounded-2xl border border-pink-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3.5 border-b border-pink-100 font-display font-bold text-sm text-slate-900 bg-pink-50/40">
          Recorded Calls ({calls.length})
        </div>
        <div className="divide-y divide-pink-50 max-h-[650px] overflow-y-auto">
          {calls.length === 0 ? (
            <p className="p-6 text-xs text-slate-500">No calls recorded yet.</p>
          ) : (
            calls.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c)}
                className={`w-full text-left p-4 hover:bg-pink-50/60 transition cursor-pointer ${
                  selected?.id === c.id ? "bg-pink-50 border-l-4 border-pink-500" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900">{c.customer_name}</span>
                  <span className="text-[11px] uppercase px-2 py-0.5 rounded-md bg-pink-100 text-pink-700 font-semibold">
                    {c.mode}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <PhoneCall className="h-3 w-3" />
                  {c.duration_seconds}s • {c.language.toUpperCase()} • {c.status}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formatISTDateTime(c.started_at)}
                </p>
                <div className="flex gap-1.5 mt-2">
                  <StatusBadge value={c.sentiment} />
                  <StatusBadge value={c.buying_intent} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-5">
        {selected ? (
          <>
            {selected.summary && (
              <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-pink-500" />
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      AI Call Summary & Business Insights (Call #{selected.id})
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-pink-800 bg-pink-50 border border-pink-200 px-2.5 py-1 rounded-full tabular-nums">
                    Score: {Math.round(selected.summary.lead_score)}/100 (
                    {selected.summary.lead_qualification_result})
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{selected.summary.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-3 border-t border-pink-100">
                  <div>
                    <span className="text-slate-400 block">Customer Requirements</span>
                    <p className="text-slate-800 mt-0.5">
                      {selected.summary.customer_requirements || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Objections Detected</span>
                    <p className="text-slate-800 mt-0.5">
                      {selected.summary.customer_objections || "None"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Appointment Details</span>
                    <p className="text-slate-800 mt-0.5">
                      {selected.summary.appointment_details || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Follow-Up Recommendation</span>
                    <p className="text-pink-700 font-semibold mt-0.5">
                      {selected.summary.follow_up_recommendations || "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-pink-500" />
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Full Conversation Transcript
                </h3>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl text-sm ${
                      m.role === "customer"
                        ? "bg-[#1a0a10] text-white ml-8"
                        : "bg-pink-50 border border-pink-100 text-slate-800 mr-8"
                    }`}
                  >
                    <div className="flex justify-between text-[11px] opacity-70 mb-1">
                      <span className="uppercase font-semibold">{m.role}</span>
                      <span>{m.phase || ""}</span>
                    </div>
                    <p>{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-sm text-slate-500">
            Select a call to view its summary and transcript.
          </div>
        )}
      </div>
    </div>
  );
}
