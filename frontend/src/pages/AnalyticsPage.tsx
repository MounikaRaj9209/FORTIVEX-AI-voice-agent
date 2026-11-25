import React, { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import type { AnalyticsOverview } from "../types";

const COLORS = ["#ec4899", "#f43f5e", "#94a3b8", "#db2777", "#fb7185"];

export function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [callStats, setCallStats] = useState<{
    total_calls: number;
    average_duration_seconds: number;
    by_language: Record<string, number>;
    by_buying_intent: Record<string, number>;
  } | null>(null);
  const [leadStats, setLeadStats] = useState<{
    total_leads: number;
    by_priority: Record<string, number>;
    by_industry: Record<string, number>;
    top_leads: { id: number; name: string; company: string | null; lead_score: number; status: string }[];
  } | null>(null);

  useEffect(() => {
    Promise.all([
      api.getAnalyticsOverview(),
      api.getCallAnalytics(),
      api.getLeadAnalytics(),
    ]).then(([ov, cs, ls]) => {
      setOverview(ov);
      setCallStats(cs);
      setLeadStats(ls);
    });
  }, []);

  if (!overview || !callStats || !leadStats) {
    return <div className="p-8 text-center text-sm text-slate-500">Loading live analytics...</div>;
  }

  const intentData = Object.entries(callStats.by_buying_intent).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-xs">
          <p className="text-xs text-slate-500">Total Calls</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {overview.total_calls}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-xs">
          <p className="text-xs text-slate-500">Avg Call Duration</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {callStats.average_duration_seconds}s
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-xs">
          <p className="text-xs text-slate-500">Qualified Leads</p>
          <p className="font-display text-2xl font-bold text-pink-600 mt-1 tabular-nums">
            {overview.qualified_leads}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-xs">
          <p className="text-xs text-slate-500">Conversion Rate</p>
          <p className="font-display text-2xl font-bold text-rose-600 mt-1 tabular-nums">
            {overview.conversion_rate}%
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-pink-200/80 p-4 shadow-xs">
          <p className="text-xs text-slate-500">Avg Lead Score</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {overview.average_lead_score}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-xs">
          <h3 className="font-display text-sm font-bold text-slate-900 mb-4">
            Lead Pipeline by Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.lead_status_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" vertical={false} />
                <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip />
                <Bar dataKey="count" name="Leads" fill="#ec4899" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-xs">
          <h3 className="font-display text-sm font-bold text-slate-900 mb-4">
            Buying Intent Breakdown
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={intentData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label
                >
                  {intentData.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-pink-200/80 p-5 shadow-xs">
        <h3 className="font-display text-sm font-bold text-slate-900 mb-3">Top Scored Leads</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-pink-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Lead</th>
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5">Score</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {leadStats.top_leads.map((tl) => (
                <tr key={tl.id}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{tl.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{tl.company || "—"}</td>
                  <td className="px-4 py-2.5 font-bold text-pink-600 tabular-nums">
                    {tl.lead_score}/100
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={tl.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
