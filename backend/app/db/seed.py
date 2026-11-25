from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.models import (
    Appointment,
    Call,
    CallSummary,
    KnowledgeDocument,
    Lead,
    Message,
    SystemSetting,
    User,
)
from app.services.lead_scoring import refresh_lead_scoring
from app.services.rag_service import index_knowledge_document

IST = timezone(timedelta(hours=5, minutes=30))

SAMPLE_KB_DOCS = [
    {
        "title": "Fortivex Cloud Solutions - Company Overview",
        "category": "company",
        "content": (
            "Fortivex Cloud Solutions is an enterprise AI communications platform specializing in "
            "Autonomous AI Sales Voice Agents, real-time speech analytics, and CRM workflow automation. "
            "Built for Indian and global B2B/B2C revenue teams to scale outbound and inbound qualification 24/7 (IST), "
            "Fortivex combines low-latency Speech-to-Text, Retrieval-Augmented Generation (RAG), and natural Text-to-Speech. "
            "Organizations using Fortivex see up to 40% reduction in customer acquisition costs and 3x faster lead qualification."
        ),
    },
    {
        "title": "Pricing Plans & Packages (INR)",
        "category": "pricing",
        "content": (
            "Fortivex offers three transparent subscription tiers in Indian Rupees (INR):\n"
            "1. Starter Plan (₹14,999/month + GST): Includes 1,000 AI voice minutes, English & Hindi multilingual support, "
            "built-in CRM lead scoring, and up to 25 knowledge base documents.\n"
            "2. Growth Plan (₹44,999/month + GST): Includes 5,000 AI voice minutes, custom voice personas, "
            "automated IST appointment scheduling, sentiment & buying intent analytics, and webhook/CRM sync.\n"
            "3. Enterprise Plan (₹1,19,999/month or custom): Includes 20,000+ minutes, dedicated vector store, "
            "SSO/RBAC, SLA 99.95% uptime guarantee, and Google Calendar / Zoho / Salesforce / HubSpot integrations.\n"
            "All annual plans receive a 15% discount and include a 14-day guided pilot."
        ),
    },
    {
        "title": "Product Features & Integrations",
        "category": "product",
        "content": (
            "Key features of the Fortivex Autonomous AI Sales Voice Agent:\n"
            "- Real-Time Voice Conversations: Sub-second turn-based and WebSocket voice pipeline with Whisper STT and neural TTS.\n"
            "- 7-Phase Sales Playbook: Automated Introduction, Discovery, Lead Qualification, RAG Product Explanation, "
            "Objection Handling, IST Appointment Booking, and Polite Conclusion.\n"
            "- Native Multilingual Engine: Supports English and Hindi seamlessly, extensible to Tamil, Telugu, and Marathi.\n"
            "- Grounded RAG Knowledge Base: Ingests PDF and TXT files with chunked semantic embeddings and source citations.\n"
            "- Smart Appointment Scheduler: Checks real-time IST slot availability, prevents double bookings, and readies Google Calendar sync."
        ),
    },
    {
        "title": "Security, Compliance & FAQs",
        "category": "faq",
        "content": (
            "Frequently Asked Questions:\n"
            "Q: How does Fortivex protect customer data?\n"
            "A: All traffic uses TLS 1.3 encryption in transit, bcrypt password hashing, JWT authentication, and strict PII minimization.\n"
            "Q: Can the AI hallucinate pricing or promises?\n"
            "A: No. Responses are strictly grounded in your uploaded Knowledge Base documents via RAG retrieval.\n"
            "Q: What are your support and demo hours?\n"
            "A: Live onboarding demos operate Monday to Saturday, 10:00 AM to 5:30 PM IST (Asia/Kolkata)."
        ),
    },
]


async def seed_initial_data(db: Session) -> None:
    """Seed demo user, INR knowledge base, Indian customer leads, calls, and IST appointments if DB is empty."""
    demo_email = "admin@fortivex.ai"
    if not db.query(User).filter(User.email == demo_email).first():
        admin = User(
            full_name="Aarav Mehta (Demo Admin)",
            email=demo_email,
            hashed_password=get_password_hash("Demo@1234"),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()

    defaults = {
        "company_name": "Fortivex Cloud Solutions India",
        "agent_name": "Aria",
        "default_language": "en",
        "demo_mode": "true",
    }
    for k, v in defaults.items():
        if not db.query(SystemSetting).filter(SystemSetting.key == k).first():
            db.add(SystemSetting(key=k, value=v))
    db.commit()

    if db.query(KnowledgeDocument).count() == 0:
        for item in SAMPLE_KB_DOCS:
            await index_knowledge_document(
                db=db,
                title=item["title"],
                content=item["content"],
                category=item["category"],
                file_type="seed",
            )

    if db.query(Lead).count() == 0:
        now_ist = datetime.now(IST)
        tomorrow_ist = (now_ist + timedelta(days=1)).strftime("%Y-%m-%d")
        day_after_ist = (now_ist + timedelta(days=2)).strftime("%Y-%m-%d")

        # ── Lead 1: Priya Sharma – High priority Fintech ──────────────────────
        lead1 = Lead(
            name="Priya Sharma",
            email="priya.sharma@novafin.in",
            phone="+91-98200-45120",
            company="NovaFin Tech (Mumbai)",
            industry="Fintech",
            budget="₹44,999/month",
            timeline="this month",
            requirements="Automate 2,000 monthly inbound loan qualification calls in English and Hindi.",
            interest_level="High",
            status="Appointment Scheduled",
            sentiment="Positive",
            buying_intent="High intent",
            preferred_language="en",
            notes="Requested Growth Plan (₹44,999/mo) pilot and CRM webhook integration.",
            created_at=now_ist - timedelta(days=7),
        )
        refresh_lead_scoring(lead1)

        # ── Lead 2: Vikramaditya Nair – Enterprise Ecommerce ──────────────────
        lead2 = Lead(
            name="Vikramaditya Nair",
            email="vikram@bharatkart.in",
            phone="+91-98450-33210",
            company="BharatKart Commerce (Bengaluru)",
            industry="Ecommerce",
            budget="₹1,19,999/month",
            timeline="this quarter",
            requirements="24/7 AI voice concierge for COD order confirmation and cart recovery across India.",
            interest_level="High",
            status="Qualified",
            sentiment="Positive",
            buying_intent="High intent",
            preferred_language="en",
            notes="Evaluating Enterprise Plan SLA and Zoho CRM connector.",
            created_at=now_ist - timedelta(days=5),
        )
        refresh_lead_scoring(lead2)

        # ── Lead 3: Rohan Verma – Healthcare Hindi ────────────────────────────
        lead3 = Lead(
            name="Rohan Verma",
            email="rohan@medcareplus.in",
            phone="+91-99100-77321",
            company="MedCare Plus Clinics (New Delhi)",
            industry="Healthcare",
            budget="₹14,999/month",
            timeline="next month",
            requirements="OPD appointment reminder and patient intake voice assistant in Hindi.",
            interest_level="Medium",
            status="Interested",
            sentiment="Neutral",
            buying_intent="Medium intent",
            preferred_language="hi",
            notes="Checking Starter Plan compliance details with clinic director.",
            created_at=now_ist - timedelta(days=3),
        )
        refresh_lead_scoring(lead3)

        # ── Lead 4: Ananya Iyer – EdTech low-budget ──────────────────────────
        lead4 = Lead(
            name="Ananya Iyer",
            email="ananya@shikshaedtech.in",
            phone="+91-97900-18442",
            company="Shiksha EdTech (Chennai)",
            industry="Education",
            budget="₹12,000/month",
            timeline="later",
            requirements="Exploring automated student admissions counseling follow-ups.",
            interest_level="Low",
            status="Contacted",
            sentiment="Neutral",
            buying_intent="Low intent",
            preferred_language="en",
            notes="Budget sensitive; shared Starter Plan (₹14,999/mo) annual discount options.",
            created_at=now_ist - timedelta(days=2),
        )
        refresh_lead_scoring(lead4)

        # ── Lead 5: Karan Malhotra – Logistics ───────────────────────────────
        lead5 = Lead(
            name="Karan Malhotra",
            email="karan.malhotra@swiftlogi.in",
            phone="+91-98310-66789",
            company="SwiftLogi (Pune)",
            industry="Logistics",
            budget="₹44,999/month",
            timeline="next 2 weeks",
            requirements="Real-time delivery status calls and missed-delivery follow-up automation.",
            interest_level="High",
            status="Qualified",
            sentiment="Positive",
            buying_intent="High intent",
            preferred_language="en",
            notes="Shortlisted Growth Plan; wants webhook integration with their TMS.",
            created_at=now_ist - timedelta(days=4),
        )
        refresh_lead_scoring(lead5)

        # ── Lead 6: Meera Pillai – Insurance ──────────────────────────────────
        lead6 = Lead(
            name="Meera Pillai",
            email="meera.pillai@insulink.in",
            phone="+91-97654-21098",
            company="InsuLink (Hyderabad)",
            industry="Insurance",
            budget="₹1,19,999/month",
            timeline="this month",
            requirements="AI policy renewal reminders and claim-status calls across Telugu and English.",
            interest_level="High",
            status="Appointment Scheduled",
            sentiment="Positive",
            buying_intent="High intent",
            preferred_language="en",
            notes="Enterprise Plan evaluation; needs Salesforce CRM integration.",
            created_at=now_ist - timedelta(days=1),
        )
        refresh_lead_scoring(lead6)

        # ── Lead 7: Arjun Kapoor – SaaS cold prospect ────────────────────────
        lead7 = Lead(
            name="Arjun Kapoor",
            email="arjun@finscale.in",
            phone="+91-99200-10001",
            company="FinScale India (Noida)",
            industry="Fintech",
            budget="₹45,000/month",
            timeline="this month",
            requirements="Outbound AI calls to convert free-trial SaaS users into paid customers.",
            interest_level="High",
            status="Interested",
            sentiment="Positive",
            buying_intent="High intent",
            preferred_language="en",
            notes="Quick follow-up needed; warm lead from inbound chat.",
            created_at=now_ist - timedelta(hours=18),
        )
        refresh_lead_scoring(lead7)

        db.add_all([lead1, lead2, lead3, lead4, lead5, lead6, lead7])
        db.flush()

        # ━━━━━━━━━━━━━━━━━━ CALLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        # Call 1 – Priya Sharma, English, High intent, completed with appointment
        call1 = Call(
            lead_id=lead1.id,
            customer_name=lead1.name,
            language="en",
            mode="demo",
            status="completed",
            current_phase="CONCLUSION",
            sentiment="Positive",
            buying_intent="High intent",
            duration_seconds=215,
            started_at=now_ist - timedelta(days=7, minutes=10),
            ended_at=now_ist - timedelta(days=7, minutes=6),
        )
        db.add(call1)
        db.flush()
        db.add_all([
            Message(
                call_id=call1.id, role="assistant",
                content="Hello Priya Sharma! I'm Aria, your AI Sales Specialist at Fortivex Cloud Solutions India. What business challenges are you looking to solve?",
                language="en", phase="INTRODUCTION",
            ),
            Message(
                call_id=call1.id, role="customer",
                content="We need to automate 2,000 monthly loan qualification calls in English and Hindi. What does Growth pricing look like in INR?",
                language="en", sentiment="Positive", buying_intent="High intent", phase="DISCOVERY",
            ),
            Message(
                call_id=call1.id, role="assistant",
                content="Our Growth Plan is ₹44,999/month + GST and includes 5,000 AI voice minutes, multilingual English & Hindi support, and automated IST appointment scheduling. Would you like to book a demo?",
                language="en", phase="PRODUCT_EXPLANATION",
            ),
            Message(
                call_id=call1.id, role="customer",
                content="Yes, let's schedule a demo tomorrow at 10:00 AM IST. My email is priya.sharma@novafin.in.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="APPOINTMENT_BOOKING",
            ),
            Message(
                call_id=call1.id, role="assistant",
                content="Wonderful, Priya! I've confirmed and booked your consultation for tomorrow at 10:00 AM IST. Is there anything else you'd like me to clarify before our meeting?",
                language="en", phase="APPOINTMENT_BOOKING",
            ),
            Message(
                call_id=call1.id, role="customer",
                content="That's perfect. Thank you so much, Aria!",
                language="en", sentiment="Positive", buying_intent="High intent", phase="CONCLUSION",
            ),
        ])

        appt1 = Appointment(
            lead_id=lead1.id, call_id=call1.id,
            customer_name=lead1.name, customer_email=lead1.email,
            appointment_date=tomorrow_ist, appointment_time="10:00",
            purpose="Growth Plan (₹44,999/mo) Pilot & Bilingual Demo",
            status="Scheduled", calendar_provider="local_db",
            notes="Booked during AI voice qualification call (10:00 AM IST)",
        )
        db.add(appt1)

        sum1 = CallSummary(
            call_id=call1.id,
            summary="Completed DEMO voice call with Priya Sharma (NovaFin Tech, Mumbai). Discussed Growth Plan (₹44,999/month) for 2,000 monthly bilingual loan qualification calls and booked a live demo at 10:00 AM IST tomorrow.",
            customer_requirements="Automate 2,000 monthly inbound loan qualification calls in English and Hindi.",
            customer_objections="None reported",
            sentiment="Positive", buying_intent="High intent",
            lead_qualification_result="Qualified",
            lead_score=float(lead1.lead_score),
            follow_up_recommendations=f"Send calendar reminder and bilingual voice sample prior to {tomorrow_ist} 10:00 AM IST.",
            appointment_details=f"{tomorrow_ist} at 10:00 IST (Scheduled) - Growth Plan (₹44,999/mo) Pilot & Bilingual Demo",
        )
        db.add(sum1)

        # Call 2 – Rohan Verma, Hindi, objection handling
        call2 = Call(
            lead_id=lead3.id,
            customer_name=lead3.name,
            language="hi", mode="demo", status="completed",
            current_phase="OBJECTION_HANDLING",
            sentiment="Neutral", buying_intent="Medium intent",
            duration_seconds=148,
            started_at=now_ist - timedelta(days=3, minutes=65),
            ended_at=now_ist - timedelta(days=3, minutes=62),
        )
        db.add(call2)
        db.flush()
        db.add_all([
            Message(
                call_id=call2.id, role="assistant",
                content="नमस्ते Rohan Verma! मैं Aria हूँ, Fortivex Cloud Solutions India से आपकी AI सेल्स स्पेशलिस्ट।",
                language="hi", phase="INTRODUCTION",
            ),
            Message(
                call_id=call2.id, role="customer",
                content="हमें दिल्ली क्लिनिक के लिए ₹14,999 वाला हिंदी वॉइस असिस्टेंट चाहिए, लेकिन अभी टीम से बात करने के लिए थोड़ा समय चाहिए।",
                language="hi", sentiment="Neutral", buying_intent="Medium intent", phase="OBJECTION_HANDLING",
            ),
            Message(
                call_id=call2.id, role="assistant",
                content="बिल्कुल, सही निर्णय लेने के लिए समय लेना जरूरी है। क्या मैं अगले हफ्ते के लिए एक छोटा फॉलो-अप डेमो शेड्यूल कर दूँ?",
                language="hi", phase="OBJECTION_HANDLING",
            ),
            Message(
                call_id=call2.id, role="customer",
                content="हाँ, अगले हफ्ते बृहस्पतिवार को 11:30 AM पर ठीक रहेगा।",
                language="hi", sentiment="Positive", buying_intent="Medium intent", phase="APPOINTMENT_BOOKING",
            ),
        ])
        sum2 = CallSummary(
            call_id=call2.id,
            summary="Hindi voice call with Rohan Verma (MedCare Plus Clinics, New Delhi) regarding ₹14,999/mo Starter Plan patient intake voice assistant. Customer objected needing team approval.",
            customer_requirements="OPD appointment reminder and patient intake voice assistant in Hindi.",
            customer_objections="Need Time – team approval required",
            sentiment="Neutral", buying_intent="Medium intent",
            lead_qualification_result="In Progress",
            lead_score=float(lead3.lead_score),
            follow_up_recommendations="Share healthcare security brief and follow up in 3 days (11:30 AM IST).",
            appointment_details="No appointment booked yet",
        )
        db.add(sum2)

        # Call 3 – Vikramaditya Nair, Enterprise pricing discussion
        call3 = Call(
            lead_id=lead2.id,
            customer_name=lead2.name,
            language="en", mode="demo", status="completed",
            current_phase="PRODUCT_EXPLANATION",
            sentiment="Positive", buying_intent="High intent",
            duration_seconds=302,
            started_at=now_ist - timedelta(days=5, hours=2),
            ended_at=now_ist - timedelta(days=5, hours=1, minutes=55),
        )
        db.add(call3)
        db.flush()
        db.add_all([
            Message(
                call_id=call3.id, role="assistant",
                content="Hello Vikramaditya! I'm Aria from Fortivex. I understand you're exploring an enterprise voice concierge for BharatKart's COD and cart-recovery workflows?",
                language="en", phase="INTRODUCTION",
            ),
            Message(
                call_id=call3.id, role="customer",
                content="Exactly. We handle about 50,000 deliveries per day across 18 states. We need 24/7 AI calling with Zoho CRM integration and 99.95% uptime SLA.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="DISCOVERY",
            ),
            Message(
                call_id=call3.id, role="assistant",
                content="That's a perfect fit for our Enterprise Plan at ₹1,19,999/month. It includes 20,000+ minutes, Zoho/Salesforce integration, SSO/RBAC, and a 99.95% SLA guarantee. Shall I book a technical deep-dive?",
                language="en", phase="PRODUCT_EXPLANATION",
            ),
            Message(
                call_id=call3.id, role="customer",
                content="Yes, please set up a technical call. Can we do the day after tomorrow at 2:00 PM IST?",
                language="en", sentiment="Positive", buying_intent="High intent", phase="APPOINTMENT_BOOKING",
            ),
            Message(
                call_id=call3.id, role="assistant",
                content="Done! I've reserved your slot for the technical deep-dive on the Enterprise Plan for 2:00 PM IST. Looking forward to it, Vikramaditya!",
                language="en", phase="APPOINTMENT_BOOKING",
            ),
        ])

        appt2 = Appointment(
            lead_id=lead2.id, call_id=call3.id,
            customer_name=lead2.name, customer_email=lead2.email,
            appointment_date=day_after_ist, appointment_time="14:00",
            purpose="Enterprise Plan (₹1,19,999/mo) & Zoho Integration Review",
            status="Scheduled", calendar_provider="local_db",
            notes="Follow-up with BharatKart engineering lead (2:00 PM IST)",
        )
        db.add(appt2)

        sum3 = CallSummary(
            call_id=call3.id,
            summary="Enterprise demo call with Vikramaditya Nair (BharatKart, Bengaluru). Requires 24/7 AI voice for 50,000 daily deliveries. Enterprise Plan (₹1,19,999/mo) with Zoho integration discussed.",
            customer_requirements="24/7 AI voice concierge for COD order confirmation and cart recovery across 18 states.",
            customer_objections="None – strong intent",
            sentiment="Positive", buying_intent="High intent",
            lead_qualification_result="Qualified",
            lead_score=float(lead2.lead_score),
            follow_up_recommendations="Send Enterprise Plan SLA document and Zoho connector spec before the technical call.",
            appointment_details=f"{day_after_ist} at 14:00 IST (Scheduled) – Enterprise technical deep-dive",
        )
        db.add(sum3)

        # Call 4 – Karan Malhotra, Logistics, completed
        call4 = Call(
            lead_id=lead5.id,
            customer_name=lead5.name,
            language="en", mode="demo", status="completed",
            current_phase="LEAD_QUALIFICATION",
            sentiment="Positive", buying_intent="High intent",
            duration_seconds=187,
            started_at=now_ist - timedelta(days=4, hours=1),
            ended_at=now_ist - timedelta(days=4, minutes=57),
        )
        db.add(call4)
        db.flush()
        db.add_all([
            Message(
                call_id=call4.id, role="assistant",
                content="Hi Karan! I'm Aria from Fortivex Cloud Solutions. I see you're interested in automating logistics follow-up calls. Tell me about your current workflow.",
                language="en", phase="INTRODUCTION",
            ),
            Message(
                call_id=call4.id, role="customer",
                content="We dispatch 3,000 parcels daily from Pune. We lose nearly 15% of deliveries because customers miss them and we can't follow up fast enough. We need automated missed-delivery calls.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="DISCOVERY",
            ),
            Message(
                call_id=call4.id, role="assistant",
                content="That's a clear ROI case, Karan. The Growth Plan at ₹44,999/month includes 5,000 AI voice minutes and webhook integration with your TMS. That's roughly ₹15 per automated call—far cheaper than a human agent.",
                language="en", phase="LEAD_QUALIFICATION",
            ),
            Message(
                call_id=call4.id, role="customer",
                content="That's very reasonable. What does the TMS webhook integration look like? We use a custom REST API.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="PRODUCT_EXPLANATION",
            ),
            Message(
                call_id=call4.id, role="assistant",
                content="Fortivex supports any REST or webhook endpoint out of the box. Our team will configure a custom connector during the onboarding pilot. Would you like to schedule that pilot call?",
                language="en", phase="PRODUCT_EXPLANATION",
            ),
        ])
        sum4 = CallSummary(
            call_id=call4.id,
            summary="Strong growth-plan call with Karan Malhotra (SwiftLogi, Pune). 3,000 daily parcels, 15% miss-rate. Clear ROI fit for Growth Plan at ₹44,999/month with TMS webhook integration.",
            customer_requirements="Real-time delivery status calls and missed-delivery follow-up automation.",
            customer_objections="None – technical question on webhook integration",
            sentiment="Positive", buying_intent="High intent",
            lead_qualification_result="Qualified",
            lead_score=float(lead5.lead_score),
            follow_up_recommendations="Send TMS webhook integration spec and schedule pilot onboarding.",
            appointment_details="Pilot onboarding to be scheduled",
        )
        db.add(sum4)

        # Call 5 – Ananya Iyer, budget objection
        call5 = Call(
            lead_id=lead4.id,
            customer_name=lead4.name,
            language="en", mode="demo", status="completed",
            current_phase="OBJECTION_HANDLING",
            sentiment="Neutral", buying_intent="Low intent",
            duration_seconds=95,
            started_at=now_ist - timedelta(days=2, hours=3),
            ended_at=now_ist - timedelta(days=2, hours=2, minutes=58),
        )
        db.add(call5)
        db.flush()
        db.add_all([
            Message(
                call_id=call5.id, role="assistant",
                content="Hi Ananya! Aria here from Fortivex. I understand you're exploring automated admissions counseling for Shiksha EdTech.",
                language="en", phase="INTRODUCTION",
            ),
            Message(
                call_id=call5.id, role="customer",
                content="Yes, but honestly ₹14,999 a month sounds expensive for a startup like us. We were hoping for something around ₹5,000.",
                language="en", sentiment="Neutral", buying_intent="Low intent", phase="OBJECTION_HANDLING",
            ),
            Message(
                call_id=call5.id, role="assistant",
                content="I completely understand keeping ROI top of mind. Our annual Starter Plan comes with a 15% discount, bringing the effective rate closer to ₹12,749/month. Teams typically cut manual outreach costs by up to 40% in the first 60 days.",
                language="en", phase="OBJECTION_HANDLING",
            ),
            Message(
                call_id=call5.id, role="customer",
                content="That's a bit better. Let me check with our finance team and get back to you.",
                language="en", sentiment="Neutral", buying_intent="Low intent", phase="OBJECTION_HANDLING",
            ),
        ])
        sum5 = CallSummary(
            call_id=call5.id,
            summary="Budget-sensitive call with Ananya Iyer (Shiksha EdTech, Chennai). Customer interested but constrained at ₹5,000/month. Presented annual discount option.",
            customer_requirements="Automated student admissions counseling follow-ups.",
            customer_objections="Too Expensive – starter plan above budget",
            sentiment="Neutral", buying_intent="Low intent",
            lead_qualification_result="In Progress",
            lead_score=float(lead4.lead_score),
            follow_up_recommendations="Follow up in 5 days with annual pricing breakdown and ROI calculator.",
            appointment_details="No appointment booked",
        )
        db.add(sum5)

        # Call 6 – Meera Pillai, Insurance, Enterprise appointment booked
        call6 = Call(
            lead_id=lead6.id,
            customer_name=lead6.name,
            language="en", mode="demo", status="completed",
            current_phase="APPOINTMENT_BOOKING",
            sentiment="Positive", buying_intent="High intent",
            duration_seconds=263,
            started_at=now_ist - timedelta(days=1, hours=2),
            ended_at=now_ist - timedelta(days=1, hours=1, minutes=55),
        )
        db.add(call6)
        db.flush()
        db.add_all([
            Message(
                call_id=call6.id, role="assistant",
                content="Hello Meera! I'm Aria from Fortivex. I hear you're looking to automate policy renewal reminders across Telugu and English for InsuLink's customer base.",
                language="en", phase="INTRODUCTION",
            ),
            Message(
                call_id=call6.id, role="customer",
                content="That's right. We renew about 8,000 policies per month and our call center is overwhelmed. We also need Salesforce integration.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="DISCOVERY",
            ),
            Message(
                call_id=call6.id, role="assistant",
                content="8,000 renewals per month is an ideal fit for our Enterprise Plan at ₹1,19,999/month. It includes Salesforce integration, multilingual Telugu & English support, and 20,000+ AI voice minutes. Shall I walk you through the integration architecture?",
                language="en", phase="PRODUCT_EXPLANATION",
            ),
            Message(
                call_id=call6.id, role="customer",
                content="Yes please. Also, can I book a Salesforce integration demo for this week? Friday at 11:30 AM works.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="APPOINTMENT_BOOKING",
            ),
            Message(
                call_id=call6.id, role="assistant",
                content="Absolutely, Meera! I've booked your Salesforce integration demo for Friday at 11:30 AM IST. I'll send the calendar invite to meera.pillai@insulink.in. See you then!",
                language="en", phase="APPOINTMENT_BOOKING",
            ),
        ])

        from datetime import date as _date
        # Find next Friday
        today = now_ist.date()
        days_to_friday = (4 - today.weekday()) % 7
        if days_to_friday == 0:
            days_to_friday = 7
        next_friday = (today + timedelta(days=days_to_friday)).strftime("%Y-%m-%d")

        appt3 = Appointment(
            lead_id=lead6.id, call_id=call6.id,
            customer_name=lead6.name, customer_email=lead6.email,
            appointment_date=next_friday, appointment_time="11:30",
            purpose="Enterprise Plan (₹1,19,999/mo) Salesforce Integration Demo",
            status="Scheduled", calendar_provider="local_db",
            notes="Booked during AI voice call – InsuLink 8,000 monthly renewals use case",
        )
        db.add(appt3)

        sum6 = CallSummary(
            call_id=call6.id,
            summary="High-value enterprise call with Meera Pillai (InsuLink, Hyderabad). 8,000 monthly policy renewals. Enterprise Plan with Salesforce integration booked for Friday 11:30 AM IST demo.",
            customer_requirements="AI policy renewal reminders and claim-status calls across Telugu and English.",
            customer_objections="None – immediate scheduling",
            sentiment="Positive", buying_intent="High intent",
            lead_qualification_result="Qualified",
            lead_score=float(lead6.lead_score),
            follow_up_recommendations="Send Salesforce connector documentation and Telugu voice sample before Friday.",
            appointment_details=f"{next_friday} at 11:30 IST (Scheduled) – Salesforce Integration Demo",
        )
        db.add(sum6)

        # Call 7 – Arjun Kapoor, inbound chat follow-up
        call7 = Call(
            lead_id=lead7.id,
            customer_name=lead7.name,
            language="en", mode="demo", status="completed",
            current_phase="LEAD_QUALIFICATION",
            sentiment="Positive", buying_intent="High intent",
            duration_seconds=172,
            started_at=now_ist - timedelta(hours=18, minutes=10),
            ended_at=now_ist - timedelta(hours=18, minutes=7),
        )
        db.add(call7)
        db.flush()
        db.add_all([
            Message(
                call_id=call7.id, role="assistant",
                content="Hello Arjun! I'm Aria from Fortivex. What specific workflows are you hoping to automate at FinScale India?",
                language="en", phase="INTRODUCTION",
            ),
            Message(
                call_id=call7.id, role="customer",
                content="My name is Arjun Kapoor from FinScale India. Our budget is ₹45,000/month and we need to automate outbound calls to convert free-trial SaaS users into paid customers this month.",
                language="en", sentiment="Positive", buying_intent="High intent", phase="LEAD_QUALIFICATION",
            ),
            Message(
                call_id=call7.id, role="assistant",
                content="Excellent, Arjun! That's a classic growth-stage use case. The Growth Plan at ₹44,999/month includes 5,000 AI voice minutes, automated follow-up scheduling, and sentiment analytics to identify your highest-intent trial users. What's your email for the proposal?",
                language="en", phase="PRODUCT_EXPLANATION",
            ),
            Message(
                call_id=call7.id, role="customer",
                content="It's arjun@finscale.in. Can we book a demo tomorrow at 11:30 am?",
                language="en", sentiment="Positive", buying_intent="High intent", phase="APPOINTMENT_BOOKING",
            ),
            Message(
                call_id=call7.id, role="assistant",
                content="Wonderful, Arjun! I've confirmed your demo for tomorrow at 11:30 AM IST. A calendar invite is on its way to arjun@finscale.in. See you then!",
                language="en", phase="APPOINTMENT_BOOKING",
            ),
        ])

        appt4 = Appointment(
            lead_id=lead7.id, call_id=call7.id,
            customer_name=lead7.name, customer_email=lead7.email,
            appointment_date=tomorrow_ist, appointment_time="11:30",
            purpose="Growth Plan (₹44,999/mo) – SaaS Trial Conversion Demo",
            status="Scheduled", calendar_provider="local_db",
            notes="Hot inbound lead – demo booked during qualification call",
        )
        db.add(appt4)

        sum7 = CallSummary(
            call_id=call7.id,
            summary="Fast qualification call with Arjun Kapoor (FinScale India, Noida). Budget ₹45,000/month exactly matching Growth Plan. SaaS trial-to-paid conversion use case. Demo booked for tomorrow 11:30 AM IST.",
            customer_requirements="Outbound AI calls to convert free-trial SaaS users into paid customers.",
            customer_objections="None – immediate booking",
            sentiment="Positive", buying_intent="High intent",
            lead_qualification_result="Qualified",
            lead_score=float(lead7.lead_score),
            follow_up_recommendations="Send Growth Plan proposal and SaaS conversion case study before the demo.",
            appointment_details=f"{tomorrow_ist} at 11:30 IST (Scheduled) – SaaS Trial Conversion Demo",
        )
        db.add(sum7)

        db.commit()
