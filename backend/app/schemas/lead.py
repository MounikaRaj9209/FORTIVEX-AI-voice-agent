from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

LeadStatus = Literal[
    "New",
    "Contacted",
    "Qualified",
    "Interested",
    "Appointment Scheduled",
    "Converted",
    "Lost",
]


class LeadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    requirements: Optional[str] = None
    interest_level: str = "Medium"
    status: LeadStatus = "New"
    sentiment: str = "Neutral"
    buying_intent: str = "Medium intent"
    preferred_language: str = "en"
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    budget: Optional[str] = None
    timeline: Optional[str] = None
    requirements: Optional[str] = None
    interest_level: Optional[str] = None
    status: Optional[LeadStatus] = None
    sentiment: Optional[str] = None
    buying_intent: Optional[str] = None
    preferred_language: Optional[str] = None
    notes: Optional[str] = None


class LeadOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    company: Optional[str]
    industry: Optional[str]
    budget: Optional[str]
    timeline: Optional[str]
    requirements: Optional[str]
    interest_level: str
    status: str
    lead_score: int
    priority: str
    sentiment: str
    buying_intent: str
    qualification_status: str
    preferred_language: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
