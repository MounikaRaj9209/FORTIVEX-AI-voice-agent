export interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface Lead {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  industry: string | null;
  budget: string | null;
  timeline: string | null;
  requirements: string | null;
  interest_level: string;
  status: string;
  lead_score: number;
  priority: string;
  sentiment: string;
  buying_intent: string;
  qualification_status: string;
  preferred_language: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RagSource {
  document_id: number;
  title: string;
  category: string;
  chunk_index: number;
  content: string;
  score: number;
}

export interface CallMessage {
  id: number;
  call_id: number;
  role: "customer" | "assistant" | "system";
  content: string;
  language: string;
  sentiment?: string | null;
  buying_intent?: string | null;
  phase?: string | null;
  sources: RagSource[];
  created_at: string;
}

export interface CallSummary {
  id: number;
  call_id: number;
  summary: string;
  customer_requirements: string | null;
  customer_objections: string | null;
  sentiment: string;
  buying_intent: string;
  lead_qualification_result: string;
  lead_score: number;
  follow_up_recommendations: string | null;
  appointment_details: string | null;
  created_at: string;
}

export interface CallRecord {
  id: number;
  lead_id: number | null;
  customer_name: string;
  language: string;
  mode: string;
  status: string;
  current_phase: string;
  sentiment: string;
  buying_intent: string;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  messages: CallMessage[];
  summary: CallSummary | null;
}

export interface CallMessageResponse {
  call_id: number;
  mode: string;
  language: string;
  phase: string;
  customer_message: CallMessage;
  assistant_message: CallMessage;
  sentiment: string;
  buying_intent: string;
  lead_id: number | null;
  lead_score: number;
  lead_status: string;
  appointment_created: Record<string, string | number> | null;
  sources: RagSource[];
}

export interface Appointment {
  id: number;
  lead_id: number | null;
  call_id: number | null;
  customer_name: string;
  customer_email: string | null;
  appointment_date: string;
  appointment_time: string;
  purpose: string;
  status: string;
  calendar_provider: string;
  external_event_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface KnowledgeDocument {
  id: number;
  title: string;
  category: string;
  file_name: string | null;
  file_type: string;
  content: string;
  chunk_count: number;
  created_at: string;
}

export interface AnalyticsOverview {
  total_calls: number;
  completed_calls: number;
  total_leads: number;
  qualified_leads: number;
  appointments_booked: number;
  conversion_rate: number;
  average_lead_score: number;
  sentiment_distribution: { name: string; value: number }[];
  lead_status_distribution: { status: string; count: number }[];
  call_activity: { date: string; calls: number; qualified: number; appointments: number }[];
  mode: string;
}

export interface SystemSettings {
  company_name: string;
  agent_name: string;
  default_language: string;
  demo_mode: boolean;
  live_ai_configured: boolean;
  mode_label: string;
  supported_languages: { code: string; label: string }[];
}
