import type {
  AnalyticsOverview,
  Appointment,
  CallMessageResponse,
  CallRecord,
  KnowledgeDocument,
  Lead,
  RagSource,
  SystemSettings,
  User,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "";

function getToken(): string | null {
  return localStorage.getItem("fortivex_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  // Health & Settings
  health: () => request<{ status: string; mode: string; demo_mode: boolean }>("/api/health"),
  getSettings: () => request<SystemSettings>("/api/settings"),
  updateSettings: (payload: { company_name?: string; agent_name?: string; default_language?: string }) =>
    request<SystemSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  // Auth
  login: (email: string, password: string) =>
    request<{ access_token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (full_name: string, email: string, password: string) =>
    request<{ access_token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password }),
    }),
  me: () => request<User>("/api/auth/me"),

  // Leads
  getLeads: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status && status !== "All") params.set("status", status);
    const qs = params.toString();
    return request<Lead[]>(`/api/leads${qs ? `?${qs}` : ""}`);
  },
  getLead: (id: number) => request<Lead>(`/api/leads/${id}`),
  createLead: (payload: Partial<Lead>) =>
    request<Lead>("/api/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateLead: (id: number, payload: Partial<Lead>) =>
    request<Lead>(`/api/leads/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteLead: (id: number) => request<void>(`/api/leads/${id}`, { method: "DELETE" }),

  // Calls
  getCalls: () => request<CallRecord[]>("/api/calls"),
  getCall: (id: number) => request<CallRecord>(`/api/calls/${id}`),
  startCall: (payload: { customer_name: string; language: string; lead_id?: number }) =>
    request<CallRecord>("/api/calls/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sendCallMessage: (
    callId: number,
    payload: { message: string; language?: string; duration_seconds?: number }
  ) =>
    request<CallMessageResponse>(`/api/calls/${callId}/message`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  endCall: (callId: number, duration_seconds: number) =>
    request<CallRecord>(`/api/calls/${callId}/end`, {
      method: "POST",
      body: JSON.stringify({ duration_seconds }),
    }),

  // Voice TTS / STT
  transcribe: (audioBlob: Blob, language: string) => {
    const fd = new FormData();
    fd.append("file", audioBlob, "recording.webm");
    fd.append("language", language);
    return request<{
      text: string;
      mode: string;
      provider: string;
      language: string;
      note?: string;
    }>("/api/ai/transcribe", {
      method: "POST",
      body: fd,
    });
  },
  speak: (text: string, language: string) =>
    request<{
      audio_base64: string;
      mime_type: string;
      mode: string;
      use_browser_tts: boolean;
      text?: string;
    }>("/api/ai/speak", {
      method: "POST",
      body: JSON.stringify({ text, language }),
    }),

  // Appointments
  getAppointments: (date?: string, status?: string) => {
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (status && status !== "All") params.set("status", status);
    const qs = params.toString();
    return request<Appointment[]>(`/api/appointments${qs ? `?${qs}` : ""}`);
  },
  getAvailableSlots: (date: string) =>
    request<{ date: string; available_slots: string[] }>(`/api/appointments/slots?date=${date}`),
  createAppointment: (payload: Partial<Appointment>) =>
    request<Appointment>("/api/appointments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateAppointment: (id: number, payload: Partial<Appointment>) =>
    request<Appointment>(`/api/appointments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteAppointment: (id: number) =>
    request<void>(`/api/appointments/${id}`, { method: "DELETE" }),

  // Knowledge Base
  getKnowledge: () => request<KnowledgeDocument[]>("/api/knowledge"),
  uploadKnowledgeFile: (formData: FormData) =>
    request<KnowledgeDocument>("/api/knowledge/upload", {
      method: "POST",
      body: formData,
    }),
  addKnowledgeText: (payload: { title: string; category: string; content: string }) =>
    request<KnowledgeDocument>("/api/knowledge/text", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  searchKnowledge: (q: string) =>
    request<{ query: string; results: RagSource[] }>(
      `/api/knowledge/search?q=${encodeURIComponent(q)}`
    ),
  deleteKnowledge: (id: number) => request<void>(`/api/knowledge/${id}`, { method: "DELETE" }),

  // Analytics
  getAnalyticsOverview: () => request<AnalyticsOverview>("/api/analytics/overview"),
  getCallAnalytics: () =>
    request<{
      total_calls: number;
      average_duration_seconds: number;
      by_language: Record<string, number>;
      by_buying_intent: Record<string, number>;
    }>("/api/analytics/calls"),
  getLeadAnalytics: () =>
    request<{
      total_leads: number;
      by_priority: Record<string, number>;
      by_industry: Record<string, number>;
      top_leads: { id: number; name: string; company: string | null; lead_score: number; status: string }[];
    }>("/api/analytics/leads"),
};
