from typing import Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.database import get_db
from app.db.models import SystemSetting, User

router = APIRouter(prefix="/api/settings", tags=["Settings"])


class SettingsUpdate(BaseModel):
    company_name: str | None = None
    agent_name: str | None = None
    default_language: str | None = None


def _build_settings_response(db: Session) -> dict:
    settings = get_settings()
    rows = db.query(SystemSetting).all()
    kv: Dict[str, str] = {r.key: r.value for r in rows}
    return {
        "company_name": kv.get("company_name", settings.company_name),
        "agent_name": kv.get("agent_name", settings.agent_name),
        "default_language": kv.get("default_language", settings.default_language),
        "demo_mode": not settings.is_live_ai_available,
        "live_ai_configured": bool(settings.openai_api_key and settings.openai_api_key.strip()),
        "mode_label": "LIVE AI MODE" if settings.is_live_ai_available else "DEMO MODE",
        "supported_languages": [
            {"code": "en", "label": "English"},
            {"code": "hi", "label": "Hindi (हिन्दी)"},
        ],
    }


@router.get("")
def get_system_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return _build_settings_response(db)


@router.put("")
def update_system_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    updates = payload.model_dump(exclude_none=True)
    for k, v in updates.items():
        row = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if row:
            row.value = str(v)
        else:
            db.add(SystemSetting(key=k, value=str(v)))
    db.commit()
    return _build_settings_response(db)
