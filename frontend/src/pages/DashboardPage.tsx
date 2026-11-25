import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck,
  Mic,
  PhoneCall,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
import { formatISTDateTime } from "../utils/format";
import type { AnalyticsOverview, CallRecord, Lead } from "../types";

const PIE_COLORS = ["#ec4899", "#94a3b8", "#e11d48"];

export function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getAnalyticsOverview(), api.getCalls(), api.getLeads()])
      .then(([ov, calls, leads]) => {
        setOverview(ov);
        setRecentCalls(calls.slice(0, 5));
        setRecentLeads(leads.slice(0, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !overview) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">Loading command dashboard...</div>
    );
  }

  const kpis = [
    {
      label: "Total Calls",
      value: overview.total_calls,
      sub: `${overview.completed_calls} completed`,
      icon: PhoneCall,
      accent: "border-l-pink-500",
      iconBg: "bg-pink-50 text-pink-600",
    },
    {
      label: "Leads Generated",
      value: overview.total_leads,
      sub: `Avg score ${overview.average_lead_score}/100`,
      icon: Users,
      accent: "border-l-rose-500",
      iconBg: "bg-rose-50 text-rose-600",
    },
    {
      label: "Qualified Leads",
      value: overview.qualified_leads,
      sub: "Score >= 55 or Qualified",
      icon: UserCheck,
      accent: "border-l-fuchsia-500",
      iconBg: "bg-fuchsia-50 text-fuchsia-600",
    },
    {
      label: "Appointments Booked",
      value: overview.appointments_booked,
      sub: `${overview.conversion_rate}% conversion`,
      icon: CalendarCheck,
      accent: "border-l-pink-400",
      iconBg: "bg-pink-50 text-pink-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Welcome Strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
            Executive Overview
          </span>
          <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
            Autonomous AI Sales Command Center
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Monitor live voice conversions, RAG-grounded answers, lead qualification scores, and booked meetings.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate("leads")}
            className="px-4 py-2.5 rounded-xl border border-pink-200 bg-white hover:bg-pink-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            View CRM Pipeline
          </button>
          <button
            onClick={() => onNavigate("voice-agent")}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold rounded-xl transition shadow-xs cursor-pointer"
          >
            <Mic className="h-4 w-4" />
            Launch AI Voice Call
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className={`bg-white rounded-2xl border border-slate-200/80 border-l-4 ${kpi.accent} p-5 shadow-xs flex items-start justify-between`}
            >
              <div>
                <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                <p className="font-display text-3xl font-bold text-slate-900 mt-1 tabular-nums">
                  {kpi.value}
                </p>
                <p className="text-xs text-slate-500 mt-1.5">{kpi.sub}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${kpi.iconBg}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900">
                Call & Appointment Velocity
              </h3>
              <p className="text-xs text-slate-500">Recorded sessions and conversions over time</p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 text-pink-700 text-xs font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              Live DB Metrics
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.call_activity}>
                <defs>
                  <linearGradient id="callGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="apptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="calls"
                  name="Calls"
                  stroke="#ec4899"
                  fill="url(#callGrad)"
                  strokeWidth={2.5}
                />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  name="Appointments"
                  stroke="#f43f5e"
                  fill="url(#apptGrad)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">Customer Sentiment</h3>
            <p className="text-xs text-slate-500">Classified across active & completed calls</p>
          </div>
          <div className="h-48 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={overview.sentiment_distribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={4}
                >
                  {overview.sentiment_distribution.map((entry, idx) => (
                    <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center">
            {overview.sentiment_distribution.map((item, idx) => (
              <div key={item.name} className="p-2 rounded-xl bg-slate-50">
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  {item.name}
                </div>
                <p className="font-display text-sm font-bold text-slate-900 mt-0.5 tabular-nums">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-slate-900">Recent Calls</h3>
            <button
              onClick={() => onNavigate("calls")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:text-pink-700 cursor-pointer"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentCalls.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No calls recorded yet.</p>
            ) : (
              recentCalls.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.customer_name}</p>
                    <p className="text-xs text-slate-500">
                      {c.language.toUpperCase()} • {c.duration_seconds}s • {formatISTDateTime(c.started_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge value={c.sentiment} />
                    <StatusBadge value={c.buying_intent} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-sm font-bold text-slate-900">Recent Leads</h3>
            <button
              onClick={() => onNavigate("leads")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:text-pink-700 cursor-pointer"
            >
              Open CRM <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLeads.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No leads yet.</p>
            ) : (
              recentLeads.map((l) => (
                <div key={l.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{l.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {l.company || l.industry || "Prospect"} • Score {l.lead_score}/100
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusBadge value={l.priority} />
                    <StatusBadge value={l.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
