from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AIChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    language: str = Field(default="en")
    history: List[Dict[str, str]] = Field(default_factory=list)
    customer_context: Dict[str, Any] = Field(default_factory=dict)


class AIChatResponse(BaseModel):
    reply: str
    mode: str
    language: str
    phase: str
    sentiment: str
    buying_intent: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)


class AISpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    language: str = Field(default="en")
    voice: Optional[str] = None


class AIAnalyzeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    language: str = Field(default="en")


class AIAnalyzeResponse(BaseModel):
    sentiment: str
    buying_intent: str
    confidence: float
    signals: List[str] = Field(default_factory=list)
    mode: str
