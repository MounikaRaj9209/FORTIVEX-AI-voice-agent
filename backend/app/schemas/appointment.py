from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    lead_id: Optional[int] = None
    call_id: Optional[int] = None
    customer_name: str = Field(..., min_length=1, max_length=150)
    customer_email: Optional[str] = None
    appointment_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    appointment_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    purpose: str = Field(default="Product Demo & Consultation", max_length=255)
    status: str = Field(default="Scheduled", max_length=40)
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=150)
    customer_email: Optional[str] = None
    appointment_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    appointment_time: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    purpose: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    lead_id: Optional[int]
    call_id: Optional[int]
    customer_name: str
    customer_email: Optional[str]
    appointment_date: str
    appointment_time: str
    purpose: str
    status: str
    calendar_provider: str
    external_event_id: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}
