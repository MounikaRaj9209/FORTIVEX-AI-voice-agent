# System Architecture

## Overview

Fortivex AI is designed as a modular, API-first **Autonomous AI Sales Voice Agent** platform. It supports two explicitly separated runtime modes:

- **DEMO MODE (Default when no API key is provided)**: Uses browser Web Speech API (`SpeechRecognition` + `speechSynthesis`), deterministic local feature-hashing vector embeddings stored in SQLite, rule-enhanced sentiment & intent classification, and grounded template/RAG sales responses.
- **LIVE AI MODE (When `DEMO_MODE=false` and `OPENAI_API_KEY` is configured)**: Uses OpenAI-compatible Chat Completions, Whisper STT, Neural TTS, and dense API embeddings, with automatic graceful fallback to local engines on transient failures.

## End-to-End Architecture Diagram

```mermaid
flowchart TD
    FE["Frontend (React + TypeScript + Tailwind + Recharts + Web Speech API)"]
    GW["API Gateway / FastAPI (REST + WebSockets)"]
    AUTH["Authentication & Session Management (JWT + bcrypt)"]
    ORCH["AI Conversation Orchestrator (7-Phase Sales Playbook + Multilingual)"]

    STT["STT (Web Speech / Whisper)"]
    LLM["LLM Engine (Live OpenAI-Compatible / Demo Grounded Engine)"]
    RAG["RAG Retriever (Chunking + Cosine Vector Search + Source Citations)"]
    TTS["TTS (Browser SpeechSynthesis / Neural TTS)"]

    CRM["CRM & Lead Scoring Engine (0-100 Score + Entity Extraction)"]
    DB["Relational Database (SQLite MVP / PostgreSQL Prod)"]
    VDB["Vector Store (KnowledgeChunks Embeddings / Managed Vector DB)"]
    APPT["Appointment Scheduler (Slot Availability + Double-Booking Guard)"]
    SUMM["Call Summarization & Analytics Engine"]

    EXT_AI["External AI Providers (OpenAI / Whisper / TTS)"]
    EXT_CAL["Future Integrations (Google Calendar / HubSpot / Salesforce)"]

    FE -->|HTTPS / WSS| GW
    GW --> AUTH
    AUTH --> ORCH
    ORCH --> STT
    STT --> LLM
    LLM <--> RAG
    LLM --> TTS
    TTS --> FE

    RAG <--> VDB
    ORCH --> CRM
    ORCH --> APPT
    ORCH --> SUMM
    CRM <--> DB
    APPT <--> DB
    SUMM <--> DB

    STT -.->|Live Mode| EXT_AI
    LLM -.->|Live Mode| EXT_AI
    TTS -.->|Live Mode| EXT_AI
    APPT -.->|Production Webhook| EXT_CAL
```

## 7-Phase Sales Conversation State Machine

1. **INTRODUCTION**: Agent introduces itself and company in the selected language (`en` / `hi`).
2. **DISCOVERY**: Probes customer pain points and business goals.
3. **LEAD_QUALIFICATION**: Collects missing fields (name, email, phone, industry, budget, timeline, requirements) without repeating already-captured fields.
4. **PRODUCT_EXPLANATION**: Grounds answers strictly in retrieved Knowledge Base chunks with source citations.
5. **OBJECTION_HANDLING**: Addresses pricing, timing, competitor, or interest objections empathetically.
6. **APPOINTMENT_BOOKING**: Checks real-time slot availability, prevents double booking, and writes confirmed appointments to the database.
7. **CONCLUSION**: Closes politely and triggers automated post-call summarization.
