from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(40), default="admin", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, default="Prospective Customer")
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    company = Column(String(150), nullable=True)
    industry = Column(String(120), nullable=True)
    budget = Column(String(100), nullable=True)
    timeline = Column(String(100), nullable=True)
    requirements = Column(Text, nullable=True)
    interest_level = Column(String(50), default="Medium", nullable=False)
    status = Column(String(50), default="New", index=True, nullable=False)
    lead_score = Column(Integer, default=20, nullable=False)
    priority = Column(String(30), default="Medium", nullable=False)
    sentiment = Column(String(30), default="Neutral", nullable=False)
    buying_intent = Column(String(40), default="Medium intent", nullable=False)
    qualification_status = Column(String(50), default="Unqualified", nullable=False)
    preferred_language = Column(String(20), default="en", nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    calls = relationship("Call", back_populates="lead", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="lead", cascade="all, delete-orphan")


class Call(Base):
    __tablename__ = "calls"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
    customer_name = Column(String(150), default="Website Visitor", nullable=False)
    language = Column(String(20), default="en", nullable=False)
    mode = Column(String(20), default="demo", nullable=False)  # demo | live
    status = Column(String(30), default="active", index=True, nullable=False)  # active | completed
    current_phase = Column(String(50), default="INTRODUCTION", nullable=False)
    sentiment = Column(String(30), default="Neutral", nullable=False)
    buying_intent = Column(String(40), default="Medium intent", nullable=False)
    duration_seconds = Column(Integer, default=0, nullable=False)
    started_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    lead = relationship("Lead", back_populates="calls")
    messages = relationship(
        "Message", back_populates="call", cascade="all, delete-orphan", order_by="Message.id"
    )
    summary = relationship(
        "CallSummary", back_populates="call", uselist=False, cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # customer | assistant | system
    content = Column(Text, nullable=False)
    language = Column(String(20), default="en", nullable=False)
    sentiment = Column(String(30), nullable=True)
    buying_intent = Column(String(40), nullable=True)
    phase = Column(String(50), nullable=True)
    sources_json = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    call = relationship("Call", back_populates="messages")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id"), nullable=True)
    customer_name = Column(String(150), nullable=False)
    customer_email = Column(String(255), nullable=True)
    appointment_date = Column(String(20), nullable=False, index=True)  # YYYY-MM-DD
    appointment_time = Column(String(20), nullable=False, index=True)  # HH:MM
    purpose = Column(String(255), default="Product Demo & Consultation", nullable=False)
    status = Column(String(40), default="Scheduled", nullable=False)
    calendar_provider = Column(String(40), default="local_db", nullable=False)
    external_event_id = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    lead = relationship("Lead", back_populates="appointments")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    category = Column(String(80), default="general", nullable=False)
    file_name = Column(String(255), nullable=True)
    file_type = Column(String(30), default="text", nullable=False)
    content = Column(Text, nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    chunks = relationship(
        "KnowledgeChunk", back_populates="document", cascade="all, delete-orphan"
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("knowledge_documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=False)  # JSON serialized vector for local/API embeddings
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    document = relationship("KnowledgeDocument", back_populates="chunks")


class CallSummary(Base):
    __tablename__ = "call_summaries"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(Integer, ForeignKey("calls.id"), unique=True, nullable=False, index=True)
    summary = Column(Text, nullable=False)
    customer_requirements = Column(Text, nullable=True)
    customer_objections = Column(Text, nullable=True)
    sentiment = Column(String(30), default="Neutral", nullable=False)
    buying_intent = Column(String(40), default="Medium intent", nullable=False)
    lead_qualification_result = Column(String(80), default="Qualified", nullable=False)
    lead_score = Column(Float, default=0.0, nullable=False)
    follow_up_recommendations = Column(Text, nullable=True)
    appointment_details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    call = relationship("Call", back_populates="summary")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
