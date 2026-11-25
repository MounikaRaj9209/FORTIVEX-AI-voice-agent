from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.database import get_db
from app.db.models import KnowledgeDocument, User
from app.schemas.knowledge import KnowledgeDocumentOut, KnowledgeTextCreate
from app.services.rag_service import (
    extract_text_from_upload,
    index_knowledge_document,
    retrieve_relevant_chunks,
)

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge Base & RAG"])

ALLOWED_EXTENSIONS = (".txt", ".md", ".pdf", ".csv")
MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB


@router.get("", response_model=List[KnowledgeDocumentOut])
def list_knowledge_documents(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return db.query(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc(), KnowledgeDocument.id.desc()).all()


@router.post("/upload", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_knowledge_document(
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Form(None),
    category: str = Form("general"),
    content: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if file and file.filename:
        lower = file.filename.lower()
        if not lower.endswith(ALLOWED_EXTENSIONS):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only .pdf, .txt, .md, and .csv files are supported.",
            )
        raw_bytes = await file.read()
        if len(raw_bytes) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File exceeds 5 MB limit.",
            )
        extracted = extract_text_from_upload(file.filename, raw_bytes)
        if not extracted.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract readable text from the uploaded file.",
            )
        doc_title = (title or file.filename).strip()
        file_type = "pdf" if lower.endswith(".pdf") else "txt"
        return await index_knowledge_document(
            db=db,
            title=doc_title,
            content=extracted,
            category=category,
            file_name=file.filename,
            file_type=file_type,
        )

    if content and content.strip():
        doc_title = (title or "Company Knowledge Entry").strip()
        return await index_knowledge_document(
            db=db,
            title=doc_title,
            content=content.strip(),
            category=category,
            file_type="text",
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Provide either a PDF/TXT file or text content.",
    )


@router.post("/text", response_model=KnowledgeDocumentOut, status_code=status.HTTP_201_CREATED)
async def add_knowledge_text(
    payload: KnowledgeTextCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await index_knowledge_document(
        db=db,
        title=payload.title.strip(),
        content=payload.content.strip(),
        category=payload.category,
        file_type="text",
    )


@router.get("/search")
async def search_knowledge(
    q: str = Query(..., min_length=2),
    top_k: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    results = await retrieve_relevant_chunks(db, q, top_k=top_k)
    return {"query": q, "results": results}


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_knowledge_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    doc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    db.delete(doc)
    db.commit()
    return None
