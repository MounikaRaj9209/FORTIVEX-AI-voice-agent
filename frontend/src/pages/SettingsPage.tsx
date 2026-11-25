import React, { useState } from "react";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function SettingsPage() {
  const { settings, refreshSettings } = useAuth();
  const [companyName, setCompanyName] = useState(settings?.company_name || "Fortivex Cloud Solutions");
  const [agentName, setAgentName] = useState(settings?.agent_name || "Aria");
  const [defaultLanguage, setDefaultLanguage] = useState(settings?.default_language || "en");
  const [saved, setSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);
    await api.updateSettings({
      company_name: companyName,
      agent_name: agentName,
      default_language: defaultLanguage,
    });
    await refreshSettings();
    setSaved(true);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">AI Runtime Mode</h3>
            <p className="text-xs text-slate-500">
              Clearly distinguishes Demo Mode (local RAG + mock AI + Web Speech) from Live OpenAI-compatible AI Mode.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              settings?.demo_mode
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-teal-50 text-teal-800 border-teal-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {settings?.mode_label || "DEMO MODE"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="font-semibold text-slate-800">Active Capabilities</p>
            <ul className="mt-2 space-y-1.5 text-slate-600">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Local Vector Embeddings & RAG
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Browser Web Speech STT / TTS
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Lead Scoring & Sentiment Engine
              </li>
            </ul>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="font-semibold text-slate-800">External Provider Status</p>
            <p className="mt-2 text-slate-600">
              OPENAI_API_KEY:{" "}
              <strong>{settings?.live_ai_configured ? "Configured" : "Not set (using Demo Mode)"}</strong>
            </p>
            <p className="mt-1 text-slate-500">
              Set <code className="text-slate-700">DEMO_MODE=false</code> and{" "}
              <code className="text-slate-700">OPENAI_API_KEY</code> in{" "}
              <code className="text-slate-700">.env</code> to switch to Live AI Mode.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          <h3 className="font-display text-base font-bold text-slate-900">
            Agent & Workspace Configuration
          </h3>
        </div>

        {saved && (
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs">
            Settings saved successfully.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="text-xs font-medium text-slate-700">Company Name</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">AI Agent Persona Name</label>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-700">Default Conversation Language</label>
            <select
              value={defaultLanguage}
              onChange={(e) => setDefaultLanguage(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl bg-white"
            >
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl cursor-pointer shadow-xs"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
}
