import React, { useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { AppointmentsPage } from "./pages/AppointmentsPage";
import { AuthPage } from "./pages/AuthPage";
import { CallHistoryPage } from "./pages/CallHistoryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { LeadsPage } from "./pages/LeadsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { VoiceAgentPage } from "./pages/VoiceAgentPage";

const NAV_SECTIONS = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "voice-agent", label: "AI Voice Agent", icon: Mic },
    ],
  },
  {
    title: "Revenue & Ops",
    items: [
      { id: "leads", label: "Leads / CRM", icon: Users },
      { id: "appointments", label: "Appointments", icon: Calendar },
      { id: "calls", label: "Call History", icon: History },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
      { id: "analytics", label: "Analytics", icon: BarChart3 },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export default function App() {
  const { user, settings, loading, logout } = useAuth();
  const [activePage, setActivePage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0a10] flex items-center justify-center text-pink-200 text-sm">
        Initializing Fortivex AI Platform...
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const currentNav = ALL_ITEMS.find((n) => n.id === activePage) || ALL_ITEMS[0];

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return <DashboardPage onNavigate={setActivePage} />;
      case "voice-agent":
        return <VoiceAgentPage />;
      case "leads":
        return <LeadsPage />;
      case "appointments":
        return <AppointmentsPage />;
      case "knowledge":
        return <KnowledgeBasePage />;
      case "calls":
        return <CallHistoryPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-pink-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Deep Rose Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-[#1a0a10] text-pink-100 border-r border-pink-900/60 flex flex-col transition-all duration-200 lg:static lg:translate-x-0 ${
          collapsed ? "w-[74px]" : "w-64"
        } ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-pink-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shrink-0 shadow-sm shadow-pink-950/50">
              <Bot className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="font-display font-bold text-[15px] tracking-tight text-white block truncate">
                  Fortivex AI
                </span>
                <span className="text-[11px] text-pink-400 block truncate">Revenue Voice OS</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-pink-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-pink-400 hover:text-white hover:bg-pink-900/60 transition cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-pink-600">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activePage;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePage(item.id);
                        setMobileMenuOpen(false);
                      }}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition cursor-pointer ${
                        active
                          ? "bg-pink-600/20 text-pink-300 border border-pink-500/30 shadow-xs"
                          : "text-pink-300/70 hover:bg-pink-900/50 hover:text-pink-100 border border-transparent"
                      } ${collapsed ? "justify-center px-2" : ""}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-pink-400" : ""}`} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile */}
        <div className="p-3 border-t border-pink-900/60 space-y-2">
          {!collapsed && (
            <div className="px-2 py-1.5 rounded-xl bg-pink-950/60 border border-pink-900/60 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-700 to-rose-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {user.full_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-pink-100 truncate">{user.full_name}</p>
                <p className="text-[11px] text-pink-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            onClick={logout}
            title="Sign Out"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-pink-950/60 hover:bg-pink-900/60 text-pink-300 text-xs font-medium border border-pink-900/60 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-pink-200/60 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-pink-200 text-pink-600"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-display text-lg font-bold text-slate-900 leading-tight">
                {currentNav.label}
              </h1>
              <p className="text-xs text-slate-500">
                {settings?.company_name || "Fortivex Cloud Solutions"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                settings?.demo_mode !== false
                  ? "bg-pink-50 text-pink-800 border-pink-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {settings?.mode_label || "DEMO MODE"}
            </span>

            {activePage !== "voice-agent" && (
              <button
                onClick={() => setActivePage("voice-agent")}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Mic className="h-3.5 w-3.5" />
                Start AI Call
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">{renderPage()}</main>
      </div>
    </div>
  );
}
