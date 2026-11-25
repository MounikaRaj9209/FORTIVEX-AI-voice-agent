# Live Evaluation & Demo Guide

This guide walks through the complete **16-step end-to-end business workflow** in **DEMO MODE** (no external API keys required).

## Demo Credentials

- **URL**: `http://localhost:5173`
- **Email**: `admin@fortivex.ai`
- **Password**: `Demo@1234`
- (Or click **One-Click Demo Admin Login** on the login screen.)

## Step-by-Step End-to-End Walkthrough

1. **Login & Verify Mode**: Sign in and verify the **DEMO MODE** badge is visible in the sidebar and top bar.
2. **Navigate to AI Voice Agent**: Click **AI Voice Agent** in the left navigation.
3. **Start a Call**: Enter a customer name (e.g., `Jordan Lee`), choose `English` (or `Hindi`), and click **Start Call**. Aria greets the visitor and opens Phase 1 (`INTRODUCTION`).
4. **Ask About Product / Pricing (RAG Retrieval)**: Click the microphone button (or type/use the quick prompt):
   > *"What are your pricing plans and features?"*
   - Observe the RAG source citation badge (`Pricing Plans & Packages`) beneath the AI reply.
5. **Provide Qualification Details**: Send:
   > *"My name is Jordan Lee from FinScale, budget $600/month, we need to automate outbound calls this month. My email is jordan@finscale.io."*
   - Watch the right-hand **Extracted CRM Profile** update live with Email, Budget, Timeline, Requirements, and a rising **Lead Score** (0–100).
   - Watch **Sentiment** and **Buying Intent** badges update automatically.
6. **Test Objection Handling**: Send:
   > *"It sounds a bit too expensive right now."*
   - Observe the phase shift to `OBJECTION_HANDLING` and value-driven response grounded in KB pricing.
7. **Book an Appointment**: Send:
   > *"I want to book a demo tomorrow at 11:30."*
   - The agent checks slot availability, creates the appointment in the database, updates the Lead status to `Appointment Scheduled`, and displays the green **Appointment Booked!** banner.
8. **End the Call**: Click **End Call**. The backend finalizes duration and generates a structured **Call Summary**.
9. **Inspect CRM, Appointments, Call History & Analytics**:
   - Open **Leads / CRM** to see `Jordan Lee` with updated score, priority, and status.
   - Open **Appointments** to see the booked slot (and test double-booking protection by trying to book the same date/time again).
   - Open **Call History** to view the full transcript and generated AI Call Summary.
   - Open **Analytics** and **Dashboard** to confirm all KPIs and charts reflect the new call, lead, and appointment immediately.
