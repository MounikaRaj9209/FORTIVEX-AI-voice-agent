import React, { useState } from "react";
import { Bot, CheckCircle2, Lock, Mail, ShieldCheck, Sparkles, User as UserIcon } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const HIGHLIGHTS = [
  "7-Phase Autonomous Sales Playbook (English & Hindi)",
  "RAG Knowledge Retrieval with Source Attribution",
  "Automated 0–100 Lead Scoring & Sentiment Analysis",
  "Double-Booking Protected Appointment Scheduling",
];

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("admin@fortivex.ai");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(fullName, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login("admin@fortivex.ai", "Demo@1234");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] grid grid-cols-1 lg:grid-cols-2">
      {/* Left Brand Showcase */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#0B192E] border-r border-slate-800/80 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center shadow-lg shadow-blue-950/50">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-lg tracking-tight block">Fortivex AI</span>
            <span className="text-xs text-slate-400">Autonomous Revenue Voice Platform</span>
          </div>
        </div>

        <div className="max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-400/25 text-teal-300 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Demo Mode Ready — Runs Without Paid API Keys
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight leading-tight text-white">
            Qualify leads, answer from your docs, and book meetings autonomously.
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Built for modern revenue teams with real-time speech pipelines, grounded RAG citations,
            automated CRM scoring, and executive call analytics.
          </p>
          <ul className="space-y-3 pt-2">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-teal-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          JWT Protected • Bcrypt Hashed • SQLite / PostgreSQL Ready
        </div>
      </div>

      {/* Right Sign-In Card */}
      <div className="flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-8">
          <div className="lg:hidden flex items-center gap-2.5 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900">Fortivex AI</h1>
              <p className="text-xs text-slate-500">Autonomous Sales Voice Agent</p>
            </div>
          </div>

          <h2 className="font-display text-xl font-bold text-slate-900">
            {mode === "login" ? "Sign in to your workspace" : "Create an account"}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-6">
            Access live AI voice calling, CRM pipeline, and call analytics.
          </p>

          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === "login" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
                setEmail("");
                setPassword("");
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === "register" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@fortivex.ai"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-xs"
            >
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Register & Enter"}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-[#0B1120] hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-teal-400" />
              One-Click Demo Admin Login
            </button>
            <p className="text-[11px] text-center text-slate-500 mt-2">
              Demo credentials: <code className="text-slate-700">admin@fortivex.ai</code> /{" "}
              <code className="text-slate-700">Demo@1234</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
