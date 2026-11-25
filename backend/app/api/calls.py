import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.database import SessionLocal, get_db
from app.db.models import Call, Lead, Message, User
from app.schemas.call import (
    CallEndRequest,
    CallMessageRequest,
    CallMessageResponse,
    CallOut,
    CallStartRequest,
    CallSummaryOut,
    MessageOut,
)
from app.services.lead_scoring import refresh_lead_scoring
from app.services.sales_agent import build_agent_reply, get_language_pack
from app.services.summary_service import generate_call_summary

router = APIRouter(prefix="/api/calls", tags=["Calls & Voice Engine"])


def _serialize_message(m: Message) -> MessageOut:
    sources = []
    if m.sources_json:
        try:
            sources = json.loads(m.sources_json)
        except Exception:
            sources = []
    return MessageOut(
        id=m.id,
        call_id=m.call_id,
        role=m.role,
        content=m.content,
        language=m.language,
        sentiment=m.sentiment,
        buying_intent=m.buying_intent,
        phase=m.phase,
        sources=sources,
        created_at=m.created_at,
    )


def _serialize_call(c: Call) -> CallOut:
    return CallOut(
        id=c.id,
        lead_id=c.lead_id,
        customer_name=c.customer_name,
        language=c.language,
        mode=c.mode,
        status=c.status,
        current_phase=c.current_phase,
        sentiment=c.sentiment,
        buying_intent=c.buying_intent,
        duration_seconds=c.duration_seconds,
        started_at=c.started_at,
        ended_at=c.ended_at,
        messages=[_serialize_message(m) for m in c.messages],
        summary=CallSummaryOut.model_validate(c.summary) if c.summary else None,
    )


@router.post("/start", response_model=CallOut, status_code=status.HTTP_201_CREATED)
def start_call(
    payload: CallStartRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings = get_settings()
    resolved_mode = "live" if (payload.mode == "live" and settings.is_live_ai_available) else (
        "live" if (payload.mode is None and settings.is_live_ai_available) else "demo"
    )

    lead = None
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
        if not lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    else:
        lead = Lead(
            name=payload.customer_name.strip() or "Website Visitor",
            preferred_language=payload.language,
            status="New",
        )
        refresh_lead_scoring(lead)
        db.add(lead)
        db.flush()

    call = Call(
        lead_id=lead.id,
        customer_name=lead.name,
        language=payload.language,
        mode=resolved_mode,
        status="active",
        current_phase="INTRODUCTION",
    )
    db.add(call)
    db.flush()

    pack = get_language_pack(payload.language)
    greeting = pack["greeting"].format(
        customer_name=lead.name,
        agent_name=settings.agent_name,
        company_name=settings.company_name,
    )
    greeting_msg = Message(
        call_id=call.id,
        role="assistant",
        content=greeting,
        language=payload.language,
        phase="INTRODUCTION",
    )
    db.add(greeting_msg)
    db.commit()
    db.refresh(call)
    return _serialize_call(call)


@router.post("/{call_id}/message", response_model=CallMessageResponse)
async def send_call_message(
    call_id: int,
    payload: CallMessageRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    if call.status == "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call has already ended")

    if payload.language:
        call.language = payload.language
    if payload.duration_seconds is not None:
        call.duration_seconds = max(call.duration_seconds, payload.duration_seconds)

    lead = call.lead
    use_live = call.mode == "live"

    ai_result = await build_agent_reply(
        db=db,
        call=call,
        customer_message=payload.message,
        lead=lead,
        use_live_api=use_live,
    )

    cust_msg = Message(
        call_id=call.id,
        role="customer",
        content=payload.message.strip(),
        language=call.language,
        sentiment=ai_result["sentiment"],
        buying_intent=ai_result["buying_intent"],
        phase=ai_result["phase"],
    )
    db.add(cust_msg)
    db.flush()

    asst_msg = Message(
        call_id=call.id,
        role="assistant",
        content=ai_result["reply"],
        language=call.language,
        sentiment=ai_result["sentiment"],
        buying_intent=ai_result["buying_intent"],
        phase=ai_result["phase"],
        sources_json=json.dumps(ai_result["sources"]),
    )
    db.add(asst_msg)
    db.commit()
    db.refresh(cust_msg)
    db.refresh(asst_msg)
    if lead:
        db.refresh(lead)

    return CallMessageResponse(
        call_id=call.id,
        mode=ai_result["mode"],
        language=call.language,
        phase=ai_result["phase"],
        customer_message=_serialize_message(cust_msg),
        assistant_message=_serialize_message(asst_msg),
        sentiment=ai_result["sentiment"],
        buying_intent=ai_result["buying_intent"],
        lead_id=lead.id if lead else None,
        lead_score=lead.lead_score if lead else 0,
        lead_status=lead.status if lead else "New",
        appointment_created=ai_result["appointment_created"],
        sources=ai_result["sources"],
    )


@router.post("/{call_id}/end", response_model=CallOut)
async def end_call(
    call_id: int,
    payload: CallEndRequest = CallEndRequest(),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")

    if payload.duration_seconds is not None:
        call.duration_seconds = max(call.duration_seconds, payload.duration_seconds)
    elif call.duration_seconds == 0:
        started = call.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        call.duration_seconds = max(1, int((datetime.now(timezone.utc) - started).total_seconds()))

    call.status = "completed"
    call.current_phase = "CONCLUSION"
    call.ended_at = datetime.now(timezone.utc)
    db.commit()

    await generate_call_summary(db, call)
    db.refresh(call)
    return _serialize_call(call)


@router.get("", response_model=List[CallOut])
def list_calls(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    calls = db.query(Call).order_by(Call.started_at.desc(), Call.id.desc()).all()
    return [_serialize_call(c) for c in calls]


@router.get("/{call_id}", response_model=CallOut)
def get_call(
    call_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    call = db.query(Call).filter(Call.id == call_id).first()
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return _serialize_call(call)


@router.websocket("/ws/{call_id}")
async def call_websocket(websocket: WebSocket, call_id: int):
    """Real-time WebSocket channel for turn-based voice/text streaming during an active call."""
    await websocket.accept()
    db = SessionLocal()
    try:
        call = db.query(Call).filter(Call.id == call_id).first()
        if not call:
            await websocket.send_json({"error": "Call not found"})
            await websocket.close(code=4004)
            return

        while True:
            data = await websocket.receive_json()
            text = (data.get("message") or "").strip()
            if not text:
                continue
            lang = data.get("language") or call.language
            call.language = lang
            if data.get("duration_seconds") is not None:
                call.duration_seconds = max(call.duration_seconds, int(data["duration_seconds"]))

            ai_result = await build_agent_reply(
                db=db,
                call=call,
                customer_message=text,
                lead=call.lead,
                use_live_api=(call.mode == "live"),
            )
            cust_msg = Message(
                call_id=call.id,
                role="customer",
                content=text,
                language=call.language,
                sentiment=ai_result["sentiment"],
                buying_intent=ai_result["buying_intent"],
                phase=ai_result["phase"],
            )
            asst_msg = Message(
                call_id=call.id,
                role="assistant",
                content=ai_result["reply"],
                language=call.language,
                sentiment=ai_result["sentiment"],
                buying_intent=ai_result["buying_intent"],
                phase=ai_result["phase"],
                sources_json=json.dumps(ai_result["sources"]),
            )
            db.add_all([cust_msg, asst_msg])
            db.commit()
            db.refresh(call)
            await websocket.send_json(
                {
                    "call_id": call.id,
                    "reply": ai_result["reply"],
                    "mode": ai_result["mode"],
                    "phase": ai_result["phase"],
                    "sentiment": ai_result["sentiment"],
                    "buying_intent": ai_result["buying_intent"],
                    "lead_score": call.lead.lead_score if call.lead else 0,
                    "lead_status": call.lead.status if call.lead else "New",
                    "appointment_created": ai_result["appointment_created"],
                    "sources": ai_result["sources"],
                }
            )
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
