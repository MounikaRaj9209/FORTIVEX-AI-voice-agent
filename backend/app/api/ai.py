from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import Call, Lead, User
from app.schemas.ai import (
    AIAnalyzeRequest,
    AIAnalyzeResponse,
    AIChatRequest,
    AIChatResponse,
    AISpeakRequest,
)
from app.services.sales_agent import build_agent_reply
from app.services.sentiment_service import analyze_sentiment_and_intent
from app.services.voice_service import synthesize_speech, transcribe_audio

router = APIRouter(prefix="/api/ai", tags=["AI Services"])


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    settings = get_settings()
    temp_call = Call(
        customer_name=payload.customer_context.get("name", "Visitor"),
        language=payload.language,
        mode="live" if settings.is_live_ai_available else "demo",
        current_phase=payload.customer_context.get("phase", "DISCOVERY"),
    )
    temp_lead = Lead(
        name=payload.customer_context.get("name", "Visitor"),
        email=payload.customer_context.get("email"),
        budget=payload.customer_context.get("budget"),
        timeline=payload.customer_context.get("timeline"),
        requirements=payload.customer_context.get("requirements"),
    )
    result = await build_agent_reply(
        db=db,
        call=temp_call,
        customer_message=payload.message,
        lead=temp_lead,
        use_live_api=settings.is_live_ai_available,
    )
    # Rollback ephemeral objects so stateless /chat does not mutate CRM unless using /calls
    db.rollback()
    return AIChatResponse(
        reply=result["reply"],
        mode=result["mode"],
        language=payload.language,
        phase=result["phase"],
        sentiment=result["sentiment"],
        buying_intent=result["buying_intent"],
        sources=result["sources"],
    )


@router.post("/transcribe")
async def ai_transcribe(
    file: UploadFile = File(None),
    language: str = Form("en"),
    _: User = Depends(get_current_user),
):
    audio_bytes = await file.read() if file else b""
    filename = file.filename if file and file.filename else "audio.webm"
    return await transcribe_audio(audio_bytes=audio_bytes, filename=filename, language=language)


@router.post("/speak")
async def ai_speak(
    payload: AISpeakRequest,
    _: User = Depends(get_current_user),
):
    return await synthesize_speech(
        text=payload.text,
        language=payload.language,
        voice=payload.voice,
    )


@router.post("/analyze", response_model=AIAnalyzeResponse)
async def ai_analyze(
    payload: AIAnalyzeRequest,
    _: User = Depends(get_current_user),
):
    settings = get_settings()
    res = await analyze_sentiment_and_intent(
        payload.text,
        use_live_api=settings.is_live_ai_available,
    )
    return AIAnalyzeResponse(**res)
