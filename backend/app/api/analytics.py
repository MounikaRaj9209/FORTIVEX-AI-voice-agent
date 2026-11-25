from collections import Counter, defaultdict
from datetime import timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import Appointment, Call, Lead, User
from app.schemas.analytics import AnalyticsOverview, CallTrendPoint, SentimentBucket, StatusBucket

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def analytics_overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings = get_settings()
    calls = db.query(Call).order_by(Call.started_at.asc()).all()
    leads = db.query(Lead).all()
    appointments = db.query(Appointment).filter(Appointment.status != "Cancelled").all()

    total_calls = len(calls)
    completed_calls = sum(1 for c in calls if c.status == "completed")
    total_leads = len(leads)
    qualified_leads = sum(
        1
        for l in leads
        if l.qualification_status == "Qualified"
        or l.status in ("Qualified", "Interested", "Appointment Scheduled", "Converted")
    )
    appointments_booked = len(appointments)
    conversion_rate = round((appointments_booked / total_leads * 100.0), 1) if total_leads else 0.0
    avg_score = round(sum(l.lead_score for l in leads) / total_leads, 1) if total_leads else 0.0

    # Sentiment distribution across calls (fallback to leads if no calls)
    sentiment_counts = Counter(c.sentiment for c in calls) if calls else Counter(l.sentiment for l in leads)
    sentiment_distribution = [
        SentimentBucket(name=s, value=sentiment_counts.get(s, 0))
        for s in ["Positive", "Neutral", "Negative"]
    ]

    status_counts = Counter(l.status for l in leads)
    lead_status_distribution = [
        StatusBucket(status=st, count=status_counts.get(st, 0))
        for st in [
            "New",
            "Contacted",
            "Qualified",
            "Interested",
            "Appointment Scheduled",
            "Converted",
            "Lost",
        ]
        if status_counts.get(st, 0) > 0
    ]

    # Call activity grouped by date in IST (UTC+05:30)
    ist = timezone(timedelta(hours=5, minutes=30))
    by_date = defaultdict(lambda: {"calls": 0, "qualified": 0, "appointments": 0})
    for c in calls:
        st_dt = c.started_at if c.started_at.tzinfo else c.started_at.replace(tzinfo=timezone.utc)
        d = st_dt.astimezone(ist).strftime("%Y-%m-%d")
        by_date[d]["calls"] += 1
        if c.lead and c.lead.lead_score >= 55:
            by_date[d]["qualified"] += 1
    for a in appointments:
        cr_dt = a.created_at if a.created_at.tzinfo else a.created_at.replace(tzinfo=timezone.utc)
        d = cr_dt.astimezone(ist).strftime("%Y-%m-%d")
        by_date[d]["appointments"] += 1

    call_activity = [
        CallTrendPoint(
            date=d,
            calls=vals["calls"],
            qualified=vals["qualified"],
            appointments=vals["appointments"],
        )
        for d, vals in sorted(by_date.items())
    ]

    return AnalyticsOverview(
        total_calls=total_calls,
        completed_calls=completed_calls,
        total_leads=total_leads,
        qualified_leads=qualified_leads,
        appointments_booked=appointments_booked,
        conversion_rate=conversion_rate,
        average_lead_score=avg_score,
        sentiment_distribution=sentiment_distribution,
        lead_status_distribution=lead_status_distribution,
        call_activity=call_activity,
        mode="live" if settings.is_live_ai_available else "demo",
    )


@router.get("/calls")
def analytics_calls(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    calls = db.query(Call).order_by(Call.started_at.desc()).all()
    avg_duration = round(sum(c.duration_seconds for c in calls) / len(calls), 1) if calls else 0.0
    by_lang = Counter(c.language for c in calls)
    by_intent = Counter(c.buying_intent for c in calls)
    return {
        "total_calls": len(calls),
        "average_duration_seconds": avg_duration,
        "by_language": dict(by_lang),
        "by_buying_intent": dict(by_intent),
    }


@router.get("/leads")
def analytics_leads(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    leads = db.query(Lead).all()
    by_priority = Counter(l.priority for l in leads)
    by_industry = Counter((l.industry or "Unspecified") for l in leads)
    return {
        "total_leads": len(leads),
        "by_priority": dict(by_priority),
        "by_industry": dict(by_industry),
        "top_leads": [
            {"id": l.id, "name": l.name, "company": l.company, "lead_score": l.lead_score, "status": l.status}
            for l in sorted(leads, key=lambda x: x.lead_score, reverse=True)[:5]
        ],
    }
