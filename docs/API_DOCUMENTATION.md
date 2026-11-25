# API Documentation

Base URL (local MVP): `http://localhost:8000`
Interactive OpenAPI docs: `http://localhost:8000/docs`

All endpoints except `/api/health`, `/api/auth/register`, and `/api/auth/login` require `Authorization: Bearer <JWT_TOKEN>`.

## Health & Settings
- `GET /api/health` — Returns service health and active mode (`demo` or `live`).
- `GET /api/settings` — Returns company name, agent persona, default language, and Demo/Live mode indicators.
- `PUT /api/settings` — Updates company name, agent name, or default language.

## Authentication
- `POST /api/auth/register` — `{ full_name, email, password }` → `201 Created` `{ access_token, token_type, user }`
- `POST /api/auth/login` — `{ email, password }` → `200 OK` `{ access_token, token_type, user }`
- `GET /api/auth/me` — Returns current authenticated user.

## Leads / CRM
- `GET /api/leads?search=&status=` — Search & filter leads ordered by recent updates.
- `POST /api/leads` — Creates a lead and auto-computes `lead_score`, `priority`, and `qualification_status`.
- `GET /api/leads/{id}` — Retrieve single lead profile.
- `PUT /api/leads/{id}` — Update lead fields and recalculate score.
- `DELETE /api/leads/{id}` — Delete lead and associated records.

## Calls & Voice Engine
- `POST /api/calls/start` — `{ customer_name, language, lead_id? }` → Starts call, creates/links Lead, returns opening greeting.
- `POST /api/calls/{id}/message` — `{ message, language?, duration_seconds? }` → Runs Sentiment/Intent → Entity Extraction → Lead Scoring → RAG Retrieval → Sales Response → Auto Appointment Booking.
- `POST /api/calls/{id}/end` — `{ duration_seconds? }` → Marks call completed and generates `CallSummary`.
- `GET /api/calls` — Lists all calls with transcripts and summaries.
- `GET /api/calls/{id}` — Retrieves single call details.
- `WS /api/calls/ws/{id}` — Real-time bidirectional JSON WebSocket channel for turn-based voice messages.

## Appointments
- `GET /api/appointments?date=&status=` — Lists appointments.
- `GET /api/appointments/slots?date=YYYY-MM-DD` — Lists unbooked standard time slots (`10:00`, `11:30`, `14:00`, `15:30`, `17:00`).
- `POST /api/appointments` — Books an appointment; returns `409 Conflict` if the slot is already taken.
- `PUT /api/appointments/{id}` — Updates status/time with double-booking check.
- `DELETE /api/appointments/{id}` — Deletes appointment.

## Knowledge Base & RAG
- `GET /api/knowledge` — Lists all indexed documents.
- `POST /api/knowledge/upload` — Multipart upload (`.pdf`, `.txt`, `.md`, `.csv`, max 5 MB) or form text; extracts, chunks, and indexes embeddings.
- `POST /api/knowledge/text` — JSON endpoint `{ title, category, content }` to add text knowledge.
- `GET /api/knowledge/search?q=...&top_k=4` — Semantic retrieval test endpoint with similarity scores.
- `DELETE /api/knowledge/{id}` — Deletes document and chunks.

## Analytics
- `GET /api/analytics/overview` — KPI totals, conversion rate, average lead score, sentiment distribution, lead status counts, and call activity trend.
- `GET /api/analytics/calls` — Average duration, language breakdown, buying intent breakdown.
- `GET /api/analytics/leads` — Priority, industry breakdown, and top scored leads.

## AI Utility Endpoints
- `POST /api/ai/chat` — Stateless RAG-grounded sales chat turn.
- `POST /api/ai/transcribe` — STT endpoint (Whisper in Live mode; demo fallback in Demo mode).
- `POST /api/ai/speak` — TTS endpoint (OpenAI MP3 in Live mode; browser Web Speech instruction + chime WAV in Demo mode).
- `POST /api/ai/analyze` — Sentiment & buying intent classifier.
