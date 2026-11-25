import re
from typing import Any, Dict, Optional

from app.db.models import Lead


def calculate_lead_score(
    budget: Optional[str],
    timeline: Optional[str],
    interest_level: Optional[str],
    requirements: Optional[str],
    buying_intent: Optional[str],
    sentiment: Optional[str] = None,
) -> Dict[str, Any]:
    """Compute a 0-100 lead score, priority tier, and qualification status."""
    score = 0

    # 1. Budget (up to 25 pts) — supports INR (₹ / Rs / INR / Lakh / Crore) and USD ($)
    b = (budget or "").lower()
    if b:
        numeric_vals = [int(n.replace(",", "")) for n in re.findall(r"\d[\d,]*", b)]
        max_num = max(numeric_vals) if numeric_vals else 0
        is_inr = any(tok in b for tok in ["₹", "inr", "rs", "rupee", "lakh", "crore", "लाख", "करोड़", "हजार"])
        if any(k in b for k in ["enterprise", "unlimited", "lakh", "lakhs", "crore", "लाख", "करोड़"]):
            score += 25
        elif is_inr:
            if max_num >= 80000:
                score += 25
            elif max_num >= 25000 or "हजार" in b:
                score += 18
            else:
                score += 12
        else:
            if any(k in b for k in ["5000", "10000", "10k", "50k"]) or max_num >= 2000:
                score += 25
            elif any(k in b for k in ["500", "1000", "1k", "mid", "moderate"]) or max_num >= 300:
                score += 18
            else:
                score += 12

    # 2. Purchase timeline (up to 25 pts)
    t = (timeline or "").lower()
    if t:
        if any(k in t for k in ["immediate", "asap", "now", "this week", "this month", "urgent", "तुरंत", "इसी हफ्ते", "इसी महीने"]):
            score += 25
        elif any(k in t for k in ["quarter", "1-3 month", "next month", "soon", "30 day", "अगले महीने"]):
            score += 17
        else:
            score += 9

    # 3. Customer interest & sentiment (up to 20 pts)
    il = (interest_level or "").lower()
    sent = (sentiment or "").lower()
    if il == "high" or sent == "positive":
        score += 20
    elif il == "medium" or sent == "neutral":
        score += 12
    else:
        score += 4

    # 4. Business requirements clarity (up to 15 pts)
    req = (requirements or "").strip()
    if len(req) >= 40:
        score += 15
    elif len(req) >= 10:
        score += 10
    elif req:
        score += 5

    # 5. Buying intent (up to 15 pts)
    bi = (buying_intent or "").lower()
    if "high" in bi:
        score += 15
    elif "medium" in bi:
        score += 9
    else:
        score += 3

    score = max(0, min(100, score))

    if score >= 75:
        priority = "Hot"
    elif score >= 45:
        priority = "Warm"
    else:
        priority = "Cold"

    if score >= 55:
        qualification_status = "Qualified"
    elif score >= 30:
        qualification_status = "In Progress"
    else:
        qualification_status = "Unqualified"

    return {
        "lead_score": score,
        "priority": priority,
        "qualification_status": qualification_status,
    }


def refresh_lead_scoring(lead: Lead) -> Lead:
    """Recalculate and apply score fields on a Lead ORM object."""
    result = calculate_lead_score(
        budget=lead.budget,
        timeline=lead.timeline,
        interest_level=lead.interest_level,
        requirements=lead.requirements,
        buying_intent=lead.buying_intent,
        sentiment=lead.sentiment,
    )
    lead.lead_score = result["lead_score"]
    lead.priority = result["priority"]
    lead.qualification_status = result["qualification_status"]
    return lead


def extract_lead_entities(message: str) -> Dict[str, Optional[str]]:
    """Extract customer profile and qualification entities from natural conversation."""
    extracted: Dict[str, Optional[str]] = {}

    # Email
    email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", message)
    if email_match:
        extracted["email"] = email_match.group(0)

    # Phone number
    phone_match = re.search(r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)\d{3,5}[\s-]?\d{3,5}", message)
    if phone_match and len(re.sub(r"\D", "", phone_match.group(0))) >= 8:
        extracted["phone"] = phone_match.group(0).strip()

    # Name
    name_patterns = [
        r"(?:my name is|i am|i'm|this is|call me)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
        r"(?:मेरा नाम)\s+([^\s,।]+(?:\s+[^\s,।]+)?)",
    ]
    for pat in name_patterns:
        m = re.search(pat, message, flags=re.IGNORECASE)
        if m:
            candidate = m.group(1).strip(" .,!?")
            if candidate.lower() not in {"interested", "looking", "calling", "here", "ready", "fine"}:
                extracted["name"] = candidate.title()
                break

    # Company / Industry
    company_match = re.search(
        r"(?:from|at|company is|work at|represent)\s+([A-Z][A-Za-z0-9&\s]{2,35}?)(?:[.,!?\n]| and | in |$)",
        message,
    )
    if company_match:
        extracted["company"] = company_match.group(1).strip()

    industries = [
        "healthcare", "fintech", "finance", "ecommerce", "e-commerce", "retail",
        "saas", "software", "education", "edtech", "real estate", "logistics",
        "manufacturing", "insurance", "hospitality", "marketing", "telecom",
    ]
    lower = message.lower()
    for ind in industries:
        if ind in lower:
            extracted["industry"] = ind.title()
            break

    # Budget (supports ₹, Rs., INR, $, €, lakhs, crore)
    budget_match = re.search(
        r"(?:budget(?:\s+is|\s+of|\s+around)?\s*(?:is|around|of)?\s*|बजट\s*)(₹\s?\d[\d,]*(?:\s?(?:k|K|lakh|lakhs|crore|per month|/mo|monthly|annually|year))?|(?:Rs\.?|INR|[$€])\s?\d[\d,]*(?:\s?(?:k|K|lakh|lakhs|crore|per month|/mo|monthly|annually|year))?|\d[\d,]*(?:\s?(?:rupees|inr|rs|lakh|lakhs|crore|हजार|लाख)(?:\s?(?:per month|/mo|monthly|प्रति माह))?))",
        message,
        flags=re.IGNORECASE,
    )
    if budget_match:
        extracted["budget"] = budget_match.group(1).strip()
    else:
        currency_match = re.search(
            r"((?:₹|Rs\.?|INR|[$€])\s?\d[\d,]*(?:\s?(?:k|K|lakh|lakhs|crore|per month|/mo|monthly|प्रति माह))?)",
            message,
            flags=re.IGNORECASE,
        )
        if currency_match:
            extracted["budget"] = currency_match.group(1).strip()

    # Timeline
    timeline_patterns = [
        r"(immediately|asap|right away|this week|next week|this month|next month|within \d+ (?:days|weeks|months)|q[1-4]|this quarter|तुरंत|इसी हफ्ते|इसी महीने|अगले महीने)",
    ]
    for pat in timeline_patterns:
        tm = re.search(pat, lower)
        if tm:
            extracted["timeline"] = tm.group(1).strip()
            break

    # Requirements
    req_triggers = [
        "need", "looking for", "want", "automate", "voice agent", "crm", "support",
        "outbound", "inbound", "integration", "calls", "leads", "चाहिए", "ऑटोमेट",
    ]
    if any(t in lower for t in req_triggers) and len(message.strip()) >= 12:
        extracted["requirements"] = message.strip()[:300]

    return extracted
