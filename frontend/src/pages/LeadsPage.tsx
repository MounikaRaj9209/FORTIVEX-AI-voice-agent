import React, { useEffect, useState } from "react";
import { Edit2, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { formatISTDateTime } from "../utils/format";
import type { CallRecord, Lead } from "../types";

const LEAD_STATUSES = [
  "All",
  "New",
  "Contacted",
  "Qualified",
  "Interested",
  "Appointment Scheduled",
  "Converted",
  "Lost",
];

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  company: "",
  industry: "",
  budget: "",
  timeline: "",
  requirements: "",
  interest_level: "Medium",
  status: "New",
  sentiment: "Neutral",
  buying_intent: "Medium intent",
  notes: "",
};

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadCalls, setLeadCalls] = useState<CallRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getLeads(search, statusFilter);
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedLead) {
      setLeadCalls([]);
      return;
    }
    api
      .getCalls()
      .then((all) => setLeadCalls(all.filter((c) => c.lead_id === selectedLead.id)))
      .catch(() => setLeadCalls([]));
  }, [selectedLead]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditingId(lead.id);
    setForm({
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      industry: lead.industry || "",
      budget: lead.budget || "",
      timeline: lead.timeline || "",
      requirements: lead.requirements || "",
      interest_level: lead.interest_level,
      status: lead.status,
      sentiment: lead.sentiment,
      buying_intent: lead.buying_intent,
      notes: lead.notes || "",
    });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.updateLead(editingId, form);
      } else {
        await api.createLead(form);
      }
      setModalOpen(false);
      await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save lead");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this lead from CRM?")) return;
    await api.deleteLead(id);
    if (selectedLead?.id === id) setSelectedLead(null);
    await loadLeads();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            loadLeads();
          }}
          className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]"
        >
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, company..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {LEAD_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer"
          >
            Search
          </button>
        </form>

        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div
          className={`${
            selectedLead ? "xl:col-span-2" : "xl:col-span-3"
          } bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto`}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Lead</th>
                <th className="px-4 py-3.5">Score & Priority</th>
                <th className="px-4 py-3.5">Sentiment & Intent</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading CRM leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No matching leads found.
                  </td>
                </tr>
              ) : (
                leads.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => setSelectedLead(l)}
                    className={`hover:bg-slate-50 cursor-pointer transition ${
                      selectedLead?.id === l.id ? "bg-blue-50/50" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{l.name}</p>
                      <p className="text-xs text-slate-500">
                        {l.company || "—"} {l.email ? `• ${l.email}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 tabular-nums">{l.lead_score}</span>
                        <StatusBadge value={l.priority} />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{l.qualification_status}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge value={l.sentiment} />
                        <StatusBadge value={l.buying_intent} />
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge value={l.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(l)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-blue-50 cursor-pointer"
                          title="Edit Lead"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(l.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                          title="Delete Lead"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {selectedLead && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  {selectedLead.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedLead.company || "No company"} • {selectedLead.industry || "Unspecified"}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge value={selectedLead.status} />
              <StatusBadge value={selectedLead.priority} />
              <StatusBadge value={selectedLead.qualification_status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-t border-slate-100 pt-3">
              <div>
                <span className="text-slate-400 block">Email</span>
                <span className="text-slate-800 break-all">{selectedLead.email || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone</span>
                <span className="text-slate-800">{selectedLead.phone || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Budget</span>
                <span className="text-slate-800 font-medium">{selectedLead.budget || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Timeline</span>
                <span className="text-slate-800 font-medium">{selectedLead.timeline || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Lead Score</span>
                <span className="text-slate-900 font-bold tabular-nums">
                  {selectedLead.lead_score} / 100
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Language</span>
                <span className="text-slate-800 uppercase">{selectedLead.preferred_language}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 block">Last Updated (IST)</span>
                <span className="text-slate-700">{formatISTDateTime(selectedLead.updated_at)}</span>
              </div>
            </div>

            <div className="text-xs space-y-2 border-t border-slate-100 pt-3">
              <div>
                <span className="text-slate-400 block">Requirements</span>
                <p className="text-slate-700 mt-0.5">
                  {selectedLead.requirements || "Not captured yet"}
                </p>
              </div>
              <div>
                <span className="text-slate-400 block">Notes</span>
                <p className="text-slate-700 mt-0.5">{selectedLead.notes || "—"}</p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-slate-400 block mb-1.5">
                  Call History ({leadCalls.length})
                </span>
                {leadCalls.length === 0 ? (
                  <p className="text-slate-500">No recorded calls for this lead yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {leadCalls.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex justify-between font-medium text-slate-800">
                          <span>
                            Call #{c.id} ({c.language.toUpperCase()})
                          </span>
                          <span>
                            {c.duration_seconds}s • {c.status}
                          </span>
                        </div>
                        {c.summary && (
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                            {c.summary.summary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingId ? "Edit Lead" : "Add New Lead"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>
            )}
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700">Customer Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Email</label>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Company</label>
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Industry</label>
                <input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Budget (INR)</label>
                <input
                  placeholder="₹44,999/month"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Timeline</label>
                <input
                  placeholder="this month"
                  value={form.timeline}
                  onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {LEAD_STATUSES.filter((s) => s !== "All").map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Buying Intent</label>
                <select
                  value={form.buying_intent}
                  onChange={(e) => setForm({ ...form, buying_intent: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="High intent">High intent</option>
                  <option value="Medium intent">Medium intent</option>
                  <option value="Low intent">Low intent</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-700">Requirements</label>
                <textarea
                  rows={2}
                  value={form.requirements}
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer"
                >
                  {editingId ? "Update Lead" : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
