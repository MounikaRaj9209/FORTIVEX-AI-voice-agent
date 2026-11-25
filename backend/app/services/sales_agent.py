import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Appointment, Call, Lead, Message
from app.services.lead_scoring import extract_lead_entities, refresh_lead_scoring
from app.services.rag_service import retrieve_relevant_chunks
from app.services.sentiment_service import analyze_sentiment_and_intent

SALES_PHASES = [
    "INTRODUCTION",
    "DISCOVERY",
    "LEAD_QUALIFICATION",
    "PRODUCT_EXPLANATION",
    "OBJECTION_HANDLING",
    "APPOINTMENT_BOOKING",
    "CONCLUSION",
]

STANDARD_SLOTS = ["10:00", "11:30", "14:00", "15:30", "17:00"]
IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    return datetime.now(IST)


def format_ist_slot(hhmm: str) -> str:
    try:
        dt = datetime.strptime(hhmm, "%H:%M")
        return f"{dt.strftime('%I:%M %p').lstrip('0')} IST"
    except ValueError:
        return f"{hhmm} IST"

LANGUAGE_CONFIG: Dict[str, Dict[str, str]] = {
    "en": {
        "name": "English",
        "greeting": (
            "Hello {customer_name}! I'm {agent_name}, your AI Sales Specialist at {company_name}. "
            "Thanks for connecting today. What business challenges or goals are you looking to solve?"
        ),
        "goodbye": (
            "Thank you so much for your time today, {customer_name}! "
            "If you need anything else before our next step, feel free to reach out anytime. Have a wonderful day!"
        ),
    },
    "hi": {
        "name": "Hindi",
        "greeting": (
            "नमस्ते {customer_name}! मैं {agent_name} हूँ, {company_name} से आपकी AI सेल्स स्पेशलिस्ट। "
            "आज हमसे जुड़ने के लिए धन्यवाद। आप अपने बिज़नेस में किस तरह की समस्या या लक्ष्य के लिए समाधान देख रहे हैं?"
        ),
        "goodbye": (
            "आज अपना कीमती समय देने के लिए बहुत-बहुत धन्यवाद, {customer_name}! "
            "यदि आपको कोई और जानकारी चाहिए तो बेझिझक संपर्क करें। आपका दिन शुभ हो!"
        ),
    },
}


def get_language_pack(lang: str) -> Dict[str, str]:
    code = (lang or "en").lower().split("-")[0]
    return LANGUAGE_CONFIG.get(code, LANGUAGE_CONFIG["en"])


def get_available_slots_for_date(db: Session, target_date: str) -> List[str]:
    """Return non-booked appointment slots for a given YYYY-MM-DD date."""
    booked = (
        db.query(Appointment.appointment_time)
        .filter(
            Appointment.appointment_date == target_date,
            Appointment.status != "Cancelled",
        )
        .all()
    )
    booked_set = {row[0] for row in booked}
    return [slot for slot in STANDARD_SLOTS if slot not in booked_set]


def parse_appointment_intent(message: str) -> Tuple[Optional[str], Optional[str], bool]:
    """Detect requested date (YYYY-MM-DD), time (HH:MM), and whether user is confirming/requesting booking."""
    lower = message.lower()
    booking_keywords = [
        "book", "schedule", "appointment", "meeting", "demo", "slot", "calendar",
        "tomorrow", "confirm", "अपॉइंटमेंट", "मीटिंग", "डेमो", "बुक", "कल",
    ]
    wants_booking = any(k in lower for k in booking_keywords)

    # Explicit YYYY-MM-DD
    date_match = re.search(r"(\d{4}-\d{2}-\d{2})", message)
    parsed_date: Optional[str] = date_match.group(1) if date_match else None

    if not parsed_date:
        now = now_ist()
        if "tomorrow" in lower or "कल" in lower:
            parsed_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        elif "today" in lower or "आज" in lower:
            parsed_date = now.strftime("%Y-%m-%d")
        elif "monday" in lower:
            days_ahead = (0 - now.weekday()) % 7 or 7
            parsed_date = (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
        elif "tuesday" in lower:
            days_ahead = (1 - now.weekday()) % 7 or 7
            parsed_date = (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    # Parse time like 14:00, 2:00 pm, 10 am, 11:30
    parsed_time: Optional[str] = None
    time_24 = re.search(r"\b([01]?\d|2[0-3]):([0-5]\d)\b", lower)
    time_ampm = re.search(r"\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b", lower)
    if time_ampm:
        hour = int(time_ampm.group(1))
        minute = int(time_ampm.group(2) or "0")
        meridiem = time_ampm.group(3)
        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        parsed_time = f"{hour:02d}:{minute:02d}"
    elif time_24:
        hour = int(time_24.group(1))
        minute = int(time_24.group(2))
        parsed_time = f"{hour:02d}:{minute:02d}"

    return parsed_date, parsed_time, wants_booking


def detect_objection(message: str) -> Optional[str]:
    lower = message.lower()
    if any(k in lower for k in ["expensive", "costly", "too much", "price is high", "out of budget", "महंगा"]):
        return "too_expensive"
    if any(k in lower for k in ["need more time", "think about", "later", "check with team", "समय चाहिए", "बाद में"]):
        return "need_time"
    if any(k in lower for k in ["already using", "existing provider", "have a vendor", "competitor", "पहले से उपयोग"]):
        return "existing_provider"
    if any(k in lower for k in ["not interested", "no thanks", "don't want", "रुचि नहीं"]):
        return "not_interested"
    return None


def determine_next_phase(
    current_phase: str,
    message: str,
    lead: Optional[Lead],
    rag_hits: List[Dict[str, Any]],
    objection: Optional[str],
    wants_booking: bool,
) -> str:
    lower = message.lower()
    if any(k in lower for k in ["bye", "goodbye", "thank you, that's all", "end call", "धन्यवाद बस इतना", "अलविदा"]):
        return "CONCLUSION"
    if wants_booking:
        return "APPOINTMENT_BOOKING"
    if objection:
        return "OBJECTION_HANDLING"

    question_words = ["?", "what", "how", "price", "pricing", "cost", "feature", "plan", "support", "integrate", "security", "क्या", "कैसे", "कीमत", "प्लान"]
    if any(q in lower for q in question_words) and rag_hits:
        return "PRODUCT_EXPLANATION"

    missing_qual = not (lead and lead.budget and lead.timeline and lead.requirements)
    if current_phase == "INTRODUCTION":
        return "DISCOVERY"
    if current_phase == "DISCOVERY" and missing_qual:
        return "LEAD_QUALIFICATION"
    if missing_qual:
        return "LEAD_QUALIFICATION"
    return "PRODUCT_EXPLANATION"


def _missing_qualification_prompt(lead: Optional[Lead], lang: str) -> Optional[str]:
    is_hi = lang.startswith("hi")
    if not lead:
        return (
            "क्या आप अपना नाम और अपनी कंपनी या इंडस्ट्री बता सकते हैं?"
            if is_hi
            else "Could you share your name and which industry or business you're in?"
        )
    if not lead.requirements:
        return (
            "आप अपने सेल्स या कस्टमर सपोर्ट प्रोसेस में क्या ऑटोमेट करना चाहते हैं?"
            if is_hi
            else "What specific workflows or customer challenges are you hoping to solve first?"
        )
    if not lead.budget:
        return (
            "इस समाधान के लिए आपका अनुमानित मासिक बजट कितना है?"
            if is_hi
            else "To recommend the right plan, what approximate monthly budget range do you have in mind?"
        )
    if not lead.timeline:
        return (
            "आप इस समाधान को कब तक शुरू करना चाहेंगे?"
            if is_hi
            else "And what is your target timeline to get started?"
        )
    if not lead.email:
        return (
            "अपॉइंटमेंट और सारांश भेजने के लिए कृपया अपना ईमेल पता साझा करें।"
            if is_hi
            else "What is the best email address to send the tailored proposal or meeting invite to?"
        )
    return None


async def build_agent_reply(
    db: Session,
    call: Call,
    customer_message: str,
    lead: Optional[Lead],
    use_live_api: bool = False,
) -> Dict[str, Any]:
    """Process one customer turn through Sentiment -> Entities/Lead Scoring -> RAG -> Sales Engine -> Appointment Booking."""
    settings = get_settings()
    lang = (call.language or "en").lower().split("-")[0]
    lang_pack = get_language_pack(lang)
    is_hi = lang == "hi"

    # 1. Sentiment & Buying Intent
    analysis = await analyze_sentiment_and_intent(customer_message, use_live_api=use_live_api)
    sentiment = analysis["sentiment"]
    buying_intent = analysis["buying_intent"]

    # 2. Extract Lead Entities & Update Lead (never overwrite already collected values with None)
    entities = extract_lead_entities(customer_message)
    if lead:
        if entities.get("name") and lead.name in ("Website Visitor", "Prospective Customer", ""):
            lead.name = entities["name"]
            call.customer_name = entities["name"]
        if entities.get("email") and not lead.email:
            lead.email = entities["email"]
        if entities.get("phone") and not lead.phone:
            lead.phone = entities["phone"]
        if entities.get("company") and not lead.company:
            lead.company = entities["company"]
        if entities.get("industry") and not lead.industry:
            lead.industry = entities["industry"]
        if entities.get("budget") and not lead.budget:
            lead.budget = entities["budget"]
        if entities.get("timeline") and not lead.timeline:
            lead.timeline = entities["timeline"]
        if entities.get("requirements"):
            if not lead.requirements:
                lead.requirements = entities["requirements"]
            elif entities["requirements"] not in lead.requirements:
                lead.requirements = f"{lead.requirements}; {entities['requirements']}"[:500]

        lead.sentiment = sentiment
        lead.buying_intent = buying_intent
        if "High" in buying_intent:
            lead.interest_level = "High"
        elif "Low" in buying_intent:
            lead.interest_level = "Low"
        else:
            lead.interest_level = "Medium"

        refresh_lead_scoring(lead)
        if lead.status == "New":
            lead.status = "Contacted"
        if lead.lead_score >= 55 and lead.status in ("New", "Contacted"):
            lead.status = "Qualified"
        if "High" in buying_intent and lead.status in ("New", "Contacted", "Qualified"):
            lead.status = "Interested"

    # 3. RAG Retrieval
    rag_hits = await retrieve_relevant_chunks(db, customer_message, top_k=3)

    # 4. Objection & Appointment Slot Detection
    objection = detect_objection(customer_message)
    req_date, req_time, wants_booking = parse_appointment_intent(customer_message)
    next_phase = determine_next_phase(
        call.current_phase, customer_message, lead, rag_hits, objection, wants_booking
    )

    appointment_created: Optional[Dict[str, Any]] = None
    default_tomorrow = (now_ist() + timedelta(days=1)).strftime("%Y-%m-%d")
    check_date = req_date or default_tomorrow
    available_slots = get_available_slots_for_date(db, check_date)

    # Attempt appointment creation if both date/time (or explicit confirmation with time) are present
    if wants_booking and req_time:
        # Normalize to exact standard slot if close or use requested HH:MM
        conflict = (
            db.query(Appointment)
            .filter(
                Appointment.appointment_date == check_date,
                Appointment.appointment_time == req_time,
                Appointment.status != "Cancelled",
            )
            .first()
        )
        if not conflict:
            appt = Appointment(
                lead_id=lead.id if lead else None,
                call_id=call.id,
                customer_name=lead.name if lead else call.customer_name,
                customer_email=lead.email if lead else None,
                appointment_date=check_date,
                appointment_time=req_time,
                purpose=f"AI Sales Consultation ({lead.requirements[:80]})" if lead and lead.requirements else "Product Demo & Consultation",
                status="Scheduled",
                calendar_provider="local_db",
                notes="Booked autonomously during AI voice call",
            )
            db.add(appt)
            db.flush()
            if lead:
                lead.status = "Appointment Scheduled"
                refresh_lead_scoring(lead)
            appointment_created = {
                "id": appt.id,
                "customer_name": appt.customer_name,
                "appointment_date": appt.appointment_date,
                "appointment_time": appt.appointment_time,
                "purpose": appt.purpose,
                "status": appt.status,
            }
            next_phase = "APPOINTMENT_BOOKING"

    # 5. Live LLM Generation (if configured) or Deterministic Grounded Demo Response
    reply_text: Optional[str] = None
    actual_mode = "demo"

    if use_live_api and settings.is_live_ai_available:
        try:
            history_msgs = (
                db.query(Message)
                .filter(Message.call_id == call.id)
                .order_by(Message.id.asc())
                .all()
            )[-10:]
            kb_context = "\n\n".join(
                [f"[Source: {h['title']}]\n{h['content']}" for h in rag_hits]
            ) or "No matching knowledge base entries retrieved."
            known_profile = {
                "name": lead.name if lead else call.customer_name,
                "email": lead.email if lead else None,
                "company": lead.company if lead else None,
                "industry": lead.industry if lead else None,
                "budget": lead.budget if lead else None,
                "timeline": lead.timeline if lead else None,
                "requirements": lead.requirements if lead else None,
            }
            system_prompt = (
                f"You are {settings.agent_name}, a friendly, concise, persuasive AI Sales Specialist at {settings.company_name}. "
                f"Respond strictly in {lang_pack['name']}. Current sales phase: {next_phase}. "
                f"Known customer details (DO NOT ask again for already-provided fields): {known_profile}. "
                f"Available slots for {check_date}: {available_slots}. "
                f"Appointment just created: {appointment_created}. "
                f"Ground all product/pricing answers strictly in the retrieved Knowledge Base below; never fabricate specs or prices.\n\n"
                f"Knowledge Base Context:\n{kb_context}"
            )
            messages_payload = [{"role": "system", "content": system_prompt}]
            for m in history_msgs:
                role = "assistant" if m.role == "assistant" else "user"
                messages_payload.append({"role": role, "content": m.content})
            messages_payload.append({"role": "user", "content": customer_message})

            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "messages": messages_payload,
                        "temperature": 0.4,
                        "max_tokens": 260,
                    },
                )
                resp.raise_for_status()
                reply_text = resp.json()["choices"][0]["message"]["content"].strip()
                actual_mode = "live"
        except Exception:
            reply_text = None

    if not reply_text:
        reply_text = _build_demo_response(
            phase=next_phase,
            lang=lang,
            lead=lead,
            customer_name=call.customer_name,
            rag_hits=rag_hits,
            objection=objection,
            appointment_created=appointment_created,
            check_date=check_date,
            req_time=req_time,
            available_slots=available_slots,
            is_hi=is_hi,
        )

    call.current_phase = next_phase
    call.sentiment = sentiment
    call.buying_intent = buying_intent

    return {
        "reply": reply_text,
        "mode": actual_mode,
        "phase": next_phase,
        "sentiment": sentiment,
        "buying_intent": buying_intent,
        "sources": rag_hits,
        "appointment_created": appointment_created,
    }


def _build_demo_response(
    phase: str,
    lang: str,
    lead: Optional[Lead],
    customer_name: str,
    rag_hits: List[Dict[str, Any]],
    objection: Optional[str],
    appointment_created: Optional[Dict[str, Any]],
    check_date: str,
    req_time: Optional[str],
    available_slots: List[str],
    is_hi: bool,
) -> str:
    settings = get_settings()
    name = lead.name if lead and lead.name not in ("Website Visitor", "Prospective Customer") else customer_name

    if appointment_created:
        ist_label = format_ist_slot(str(appointment_created["appointment_time"]))
        if is_hi:
            return (
                f"शानदार, {name}! मैंने आपका अपॉइंटमेंट {appointment_created['appointment_date']} को "
                f"{ist_label} पर कन्फर्म और सेव कर दिया है। "
                f"क्या मीटिंग से पहले आप किसी और विषय पर जानकारी चाहेंगे?"
            )
        return (
            f"Wonderful, {name}! I've confirmed and booked your consultation for "
            f"{appointment_created['appointment_date']} at {ist_label}. "
            f"Is there anything else you'd like me to clarify before our meeting?"
        )

    if phase == "APPOINTMENT_BOOKING":
        slots_str = ", ".join(format_ist_slot(s) for s in available_slots[:4]) if available_slots else "none remaining on that date"
        if req_time and req_time not in available_slots:
            req_ist = format_ist_slot(req_time)
            if is_hi:
                return (
                    f"{check_date} को {req_ist} का स्लॉट पहले से बुक है। "
                    f"उपलब्ध स्लॉट हैं: {slots_str}। इनमें से कौन-सा समय आपके लिए सही रहेगा?"
                )
            return (
                f"It looks like {req_ist} on {check_date} is already booked. "
                f"Available slots on {check_date} are {slots_str}. Which one works best for you?"
            )
        if is_hi:
            return (
                f"बिल्कुल {name}, मैं आपके लिए डेमो और कंसल्टेशन बुक कर सकती हूँ! "
                f"{check_date} के लिए हमारे उपलब्ध स्लॉट हैं: {slots_str}। कृपया अपनी पसंदीदा तारीख और समय बताएं।"
            )
        return (
            f"I'd be happy to schedule a personalized demo for you, {name}! "
            f"On {check_date}, we have slots open at {slots_str}. Which date and time works best for you?"
        )

    if phase == "CONCLUSION":
        return get_language_pack(lang)["goodbye"].format(customer_name=name)

    if phase == "OBJECTION_HANDLING":
        kb_snippet = rag_hits[0]["content"] if rag_hits else ""
        if objection == "too_expensive":
            if is_hi:
                base = (
                    "मैं आपकी बजट से जुड़ी चिंता समझती हूँ। हमारे कस्टमर्स आमतौर पर 40% तक सपोर्ट और सेल्स कॉलिंग खर्च बचाते हैं। "
                )
                return f"{base}{kb_snippet[:180]} क्या हम आपके बजट के अनुसार स्टार्टर प्लान पर चर्चा करें?"
            return (
                "I completely understand keeping ROI top of mind. Teams typically cut manual outreach costs by up to 40% in the first 60 days. "
                + (f"From our pricing guide: {kb_snippet[:180]} " if kb_snippet else "")
                + "Would you like to look at the starter tier or schedule a quick ROI walkthrough?"
            )
        if objection == "need_time":
            if is_hi:
                return "बिल्कुल, सही निर्णय लेने के लिए समय लेना जरूरी है। क्या मैं अगले हफ्ते के लिए एक छोटा फॉलो-अप डेमो शेड्यूल कर दूँ?"
            return "Of course—taking time to review with your team makes total sense. Would you like me to reserve a brief 15-minute slot next week so you have a spot held?"
        if objection == "existing_provider":
            if is_hi:
                return "बहुत अच्छा कि आप पहले से एक सिस्टम उपयोग कर रहे हैं। कई टीमें हमारे AI वॉइस एजेंट को मौजूदा CRM के साथ जोड़ती हैं। आप अभी किस टूल का उपयोग कर रहे हैं?"
            return "That's great that you already have a workflow in place! Many clients plug our AI Voice Agent directly into their existing CRM to automate qualification without replacing their stack. What gaps are you seeing today?"
        if is_hi:
            return "कोई बात नहीं! यदि भविष्य में आपको AI वॉइस ऑटोमेशन की आवश्यकता हो, तो हम मदद के लिए तैयार हैं। क्या मैं कोई संक्षिप्त जानकारी भेज सकती हूँ?"
        return "I respect your time completely—no pressure at all. If you'd like, I can share a brief overview for future reference, or answer one quick question before we wrap up."

    # RAG-grounded answer if relevant knowledge was found
    parts: List[str] = []
    if rag_hits:
        top = rag_hits[0]
        snippet = top["content"].strip()
        if len(snippet) > 260:
            snippet = snippet[:257].rsplit(" ", 1)[0] + "..."
        if is_hi:
            parts.append(f"हमारे नॉलेज बेस ({top['title']}) के अनुसार: {snippet}")
        else:
            parts.append(f"Based on our {top['title']}: {snippet}")

    follow_up = _missing_qualification_prompt(lead, lang)
    if follow_up:
        parts.append(follow_up)
    else:
        if is_hi:
            parts.append(
                f"आपके पास सभी मुख्य जानकारी साझा करने के लिए धन्यवाद, {name}। क्या आप {check_date} को उपलब्ध स्लॉट ({', '.join(available_slots[:3])}) में से एक लाइव डेमो बुक करना चाहेंगे?"
            )
        else:
            parts.append(
                f"Thanks for sharing those details, {name}—you look like a strong fit for {settings.company_name}. "
                f"Would you like to book a live demo on {check_date} at {format_ist_slot(available_slots[0]) if available_slots else '10:00 AM IST'}?"
            )

    return " ".join(parts)
