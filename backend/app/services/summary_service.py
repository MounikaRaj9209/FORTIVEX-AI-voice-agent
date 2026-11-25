import json
from typing import List, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Appointment, Call, CallSummary, Lead, Message
from app.services.sales_agent import detect_objection


async def generate_call_summary(db: Session, call: Call) -> CallSummary:
    """Create or update a structured CallSummary from the call's transcript, lead, and appointments."""
    messages: List[Message] = (
        db.query(Message).filter(Message.call_id == call.id).order_by(Message.id.asc()).all()
    )
    customer_msgs = [m for m in messages if m.role == "customer"]
    lead: Optional[Lead] = call.lead

    objections_found: List[str] = []
    for m in customer_msgs:
        obj = detect_objection(m.content)
        if obj and obj not in objections_found:
            objections_found.append(obj.replace("_", " ").title())

    appt = (
        db.query(Appointment)
        .filter(Appointment.call_id == call.id)
        .order_by(Appointment.id.desc())
        .first()
    )
    appt_str = (
        f"{appt.appointment_date} at {appt.appointment_time} IST ({appt.status}) - {appt.purpose}"
        if appt
        else "No appointment booked yet"
    )

    requirements = (
        lead.requirements
        if lead and lead.requirements
        else (customer_msgs[0].content[:220] if customer_msgs else "General inquiry")
    )
    lead_score = float(lead.lead_score if lead else 25.0)
    qual_result = lead.qualification_status if lead else "In Progress"

    if appt:
        follow_up = f"Send calendar reminder and tailored slide deck prior to {appt.appointment_date} {appt.appointment_time}."
    elif lead_score >= 55:
        follow_up = "High-potential lead: send pricing proposal via email and propose two demo slots within 24 hours."
    elif objections_found:
        follow_up = f"Address objection(s) ({', '.join(objections_found)}) with ROI case study and follow up in 3 days."
    else:
        follow_up = "Nurture via automated product overview email and check back next week."

    summary_text = (
        f"Completed {call.mode.upper()} voice call with {call.customer_name} in {call.language.upper()} "
        f"({len(customer_msgs)} customer turns, {call.duration_seconds}s). "
        f"Overall sentiment was {call.sentiment} with {call.buying_intent}. "
        f"Lead qualification status: {qual_result} (Score: {int(lead_score)}/100). "
        f"Appointment status: {appt_str}."
    )

    settings = get_settings()
    if settings.is_live_ai_available and customer_msgs:
        try:
            transcript = "\n".join(f"{m.role}: {m.content}" for m in messages[-14:])
            async with httpx.AsyncClient(timeout=18.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url.rstrip('/')}/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_model,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "Summarize this sales call as strict JSON with keys: "
                                    '"summary", "customer_requirements", "customer_objections", "follow_up_recommendations".'
                                ),
                            },
                            {"role": "user", "content": transcript},
                        ],
                        "temperature": 0.2,
                    },
                )
                resp.raise_for_status()
                parsed = json.loads(resp.json()["choices"][0]["message"]["content"])
                summary_text = parsed.get("summary", summary_text)
                requirements = parsed.get("customer_requirements", requirements)
                if parsed.get("customer_objections"):
                    objections_found = [str(parsed["customer_objections"])]
                follow_up = parsed.get("follow_up_recommendations", follow_up)
        except Exception:
            pass

    existing = db.query(CallSummary).filter(CallSummary.call_id == call.id).first()
    if existing:
        existing.summary = summary_text
        existing.customer_requirements = requirements
        existing.customer_objections = ", ".join(objections_found) if objections_found else "None reported"
        existing.sentiment = call.sentiment
        existing.buying_intent = call.buying_intent
        existing.lead_qualification_result = qual_result
        existing.lead_score = lead_score
        existing.follow_up_recommendations = follow_up
        existing.appointment_details = appt_str
        db.commit()
        db.refresh(existing)
        return existing

    record = CallSummary(
        call_id=call.id,
        summary=summary_text,
        customer_requirements=requirements,
        customer_objections=", ".join(objections_found) if objections_found else "None reported",
        sentiment=call.sentiment,
        buying_intent=call.buying_intent,
        lead_qualification_result=qual_result,
        lead_score=lead_score,
        follow_up_recommendations=follow_up,
        appointment_details=appt_str,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
