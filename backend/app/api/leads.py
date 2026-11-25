from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.db.models import Lead, User
from app.schemas.lead import LeadCreate, LeadOut, LeadUpdate
from app.services.lead_scoring import refresh_lead_scoring

router = APIRouter(prefix="/api/leads", tags=["Leads & CRM"])


@router.get("", response_model=List[LeadOut])
def list_leads(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(Lead)
    if status_filter and status_filter.lower() != "all":
        query = query.filter(Lead.status == status_filter)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Lead.name.ilike(term),
                Lead.email.ilike(term),
                Lead.company.ilike(term),
                Lead.industry.ilike(term),
                Lead.requirements.ilike(term),
            )
        )
    return query.order_by(Lead.updated_at.desc(), Lead.id.desc()).all()


@router.post("", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = Lead(**payload.model_dump())
    refresh_lead_scoring(lead)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    updates = payload.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(lead, key, val)

    refresh_lead_scoring(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return None
