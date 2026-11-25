from typing import Dict, List
from pydantic import BaseModel


class SentimentBucket(BaseModel):
    name: str
    value: int


class StatusBucket(BaseModel):
    status: str
    count: int


class CallTrendPoint(BaseModel):
    date: str
    calls: int
    qualified: int
    appointments: int


class AnalyticsOverview(BaseModel):
    total_calls: int
    completed_calls: int
    total_leads: int
    qualified_leads: int
    appointments_booked: int
    conversion_rate: float
    average_lead_score: float
    sentiment_distribution: List[SentimentBucket]
    lead_status_distribution: List[StatusBucket]
    call_activity: List[CallTrendPoint]
    mode: str
