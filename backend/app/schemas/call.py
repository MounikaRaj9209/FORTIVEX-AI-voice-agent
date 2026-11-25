from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class CallStartRequest(BaseModel):
    customer_name: str = Field(default="Website Visitor", max_length=150)
    language: str = Field(default="en", max_length=20)
    lead_id: Optional[int] = None
    mode: Optional[str] = None  # demo | live (auto-resolved if omitted)


class CallMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    language: Optional[str] = None
    duration_seconds: Optional[int] = None


class CallEndRequest(BaseModel):
    duration_seconds: Optional[int] = None


class MessageOut(BaseModel):
    id: int
    call_id: int
    role: str
    content: str
    language: str
    sentiment: Optional[str] = None
    buying_intent: Optional[str] = None
    phase: Optional[str] = None
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime

    model_config = {"from_attributes": True}


class CallSummaryOut(BaseModel):
    id: int
    call_id: int
    summary: str
    customer_requirements: Optional[str]
    customer_objections: Optional[str]
    sentiment: str
    buying_intent: str
    lead_qualification_result: str
    lead_score: float
    follow_up_recommendations: Optional[str]
    appointment_details: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class CallOut(BaseModel):
    id: int
    lead_id: Optional[int]
    customer_name: str
    language: str
    mode: str
    status: str
    current_phase: str
    sentiment: str
    buying_intent: str
    duration_seconds: int
    started_at: datetime
    ended_at: Optional[datetime]
    messages: List[MessageOut] = Field(default_factory=list)
    summary: Optional[CallSummaryOut] = None

    model_config = {"from_attributes": True}


class CallMessageResponse(BaseModel):
    call_id: int
    mode: str
    language: str
    phase: str
    customer_message: MessageOut
    assistant_message: MessageOut
    sentiment: str
    buying_intent: str
    lead_id: Optional[int]
    lead_score: int
    lead_status: str
    appointment_created: Optional[Dict[str, Any]] = None
    sources: List[Dict[str, Any]] = Field(default_factory=list)
