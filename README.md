# Fortivex AI — Autonomous AI Sales Voice Agent

An end-to-end **Autonomous AI Sales Voice Agent** MVP built with **React + TypeScript + Tailwind CSS**, **FastAPI**, **SQLAlchemy (SQLite/PostgreSQL)**, **Retrieval-Augmented Generation (RAG)**, **Sentiment & Buying Intent Analysis**, **Automated Lead Scoring CRM**, **Appointment Scheduling**, and **Live Analytics**.

## Key Capabilities

- **AI Sales Voice Agent**: Turn-based voice & WebSocket conversation engine with browser Web Speech API (`SpeechRecognition` & `speechSynthesis`) plus optional OpenAI Whisper/TTS integration.
- **7-Phase Sales Playbook**: Introduction → Discovery → Lead Qualification → RAG Product Explanation → Objection Handling → Appointment Booking → Conclusion.
- **Multilingual Support**: English (`en`) and Hindi (`hi`) with extensible language configuration.
- **RAG Knowledge Base**: Upload PDF/TXT or paste text; automatically chunks, embeds (OpenAI embeddings or local deterministic hashing vectors), and retrieves with source attribution.
- **CRM & Lead Scoring (0–100)**: Extracts entities from conversation, scores budget/timeline/interest/requirements/intent, and tracks pipeline statuses.
- **Double-Booking Protected Appointments**: Checks slot availability before booking and readies Google Calendar integration.
- **Demo Mode & Live AI Mode**: Works out-of-the-box with zero API keys (`DEMO_MODE=true`), clearly badged across the UI.

## Quick Start

### 1. Backend
```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

### 2. Frontend
```powershell
cd frontend
npm.cmd run dev
```

Open `http://localhost:5173` and click **One-Click Demo Admin Login** (`admin@fortivex.ai` / `Demo@1234`).

## Documentation Index

- [System Architecture](./docs/SYSTEM_ARCHITECTURE.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Database Schema](./docs/DATABASE_SCHEMA.md)
- [Scalability (100,000 Users)](./docs/SCALABILITY.md)
- [Security Architecture](./docs/SECURITY.md)
- [Cost Estimation](./docs/COST_ESTIMATION.md)
- [Live Demo Guide](./docs/DEMO_GUIDE.md)
