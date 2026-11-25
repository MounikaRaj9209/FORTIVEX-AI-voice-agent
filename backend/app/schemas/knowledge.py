from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class KnowledgeTextCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: str = Field(default="general", max_length=80)
    content: str = Field(..., min_length=10)


class KnowledgeDocumentOut(BaseModel):
    id: int
    title: str
    category: str
    file_name: Optional[str]
    file_type: str
    content: str
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
