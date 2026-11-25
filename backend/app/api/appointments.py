from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.db.models import Appointment, Lead, User
from app.schemas.appointment import AppointmentCreate, AppointmentOut, AppointmentUpdate
from app.services.lead_scoring import refresh_lead_scoring
from app.services.sales_agent import get_available_slots_for_date

router = APIRouter(prefix="/api/appointments", tags=["Appointments"])


@router.get("/slots")
def get_available_slots(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    slots = get_available_slots_for_date(db, date)
    return {"date": date, "available_slots": slots}


@router.get("", response_model=List[AppointmentOut])
def list_appointments(
    date: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Appointment)
    if date:
        query = query.filter(Appointment.appointment_date == date)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(Appointment.status == status_filter)
    return query.order_by(Appointment.appointment_date.asc(), Appointment.appointment_time.asc()).all()


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.appointment_date == payload.appointment_date,
            Appointment.appointment_time == payload.appointment_time,
            Appointment.status != "Cancelled",
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slot {payload.appointment_date} at {payload.appointment_time} is already booked.",
        )

    appt = Appointment(**payload.model_dump(), calendar_provider="local_db")
    db.add(appt)

    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
        if lead:
            lead.status = "Appointment Scheduled"
            refresh_lead_scoring(lead)

    db.commit()
    db.refresh(appt)
    return appt


@router.put("/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    updates = payload.model_dump(exclude_unset=True)
    new_date = updates.get("appointment_date", appt.appointment_date)
    new_time = updates.get("appointment_time", appt.appointment_time)
    new_status = updates.get("status", appt.status)

    if new_status != "Cancelled":
        conflict = (
            db.query(Appointment)
            .filter(
                Appointment.id != appt.id,
                Appointment.appointment_date == new_date,
                Appointment.appointment_time == new_time,
                Appointment.status != "Cancelled",
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slot {new_date} at {new_time} is already booked.",
            )

    for key, val in updates.items():
        setattr(appt, key, val)

    db.commit()
    db.refresh(appt)
    return appt


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")
    db.delete(appt)
    db.commit()
    return None
