import hashlib
import io
import json
import re
from typing import Any, Dict, List
import httpx
import numpy as np
from pypdf import PdfReader
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import KnowledgeChunk, KnowledgeDocument

EMBEDDING_DIM = 256
STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does",
    "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on",
    "or", "our", "the", "this", "to", "we", "what", "when", "which", "who",
    "with", "you", "your",
}


def extract_text_from_upload(filename: str, content_bytes: bytes) -> str:
    """Extract plain text from uploaded PDF or TXT bytes."""
    lower = filename.lower()
    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n".join(pages).strip()
    try:
        return content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return content_bytes.decode("latin-1", errors="ignore")


def split_text_into_chunks(text: str, chunk_size: int = 450, overlap: int = 80) -> List[str]:
    """Split document text into overlapping chunks respecting sentence/paragraph boundaries."""
    cleaned = re.sub(r"\r\n?", "\n", text).strip()
    if not cleaned:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", cleaned) if p.strip()]
    chunks: List[str] = []
    current = ""

    for para in paragraphs:
        if len(para) <= chunk_size:
            if len(current) + len(para) + 2 <= chunk_size:
                current = f"{current}\n\n{para}".strip()
            else:
                if current:
                    chunks.append(current)
                current = para
        else:
            sentences = re.split(r"(?<=[.!?।])\s+", para)
            for sent in sentences:
                if len(current) + len(sent) + 1 <= chunk_size:
                    current = f"{current} {sent}".strip()
                else:
                    if current:
                        chunks.append(current)
                    if len(sent) > chunk_size:
                        step = max(chunk_size - overlap, 100)
                        for idx in range(0, len(sent), step):
                            chunks.append(sent[idx : idx + chunk_size].strip())
                        current = ""
                    else:
                        current = sent
    if current:
        chunks.append(current)
    return [c for c in chunks if c]


def _local_embed_text(text: str) -> List[float]:
    """Deterministic local feature-hashing embedding supporting English & Unicode/Hindi tokens."""
    vec = np.zeros(EMBEDDING_DIM, dtype=np.float32)
    tokens = [
        t for t in re.findall(r"[\w\u0900-\u097F]+", text.lower())
        if t not in STOP_WORDS and len(t) > 1
    ]
    if not tokens:
        return vec.tolist()

    for token in tokens:
        h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
        idx = h % EMBEDDING_DIM
        sign = 1.0 if ((h >> 8) & 1) == 0 else -1.0
        vec[idx] += sign

        # Character 3-grams for fuzzy matching across inflections
        if len(token) >= 4:
            for i in range(len(token) - 2):
                gram = token[i : i + 3]
                gh = int(hashlib.md5(gram.encode("utf-8")).hexdigest(), 16)
                vec[gh % EMBEDDING_DIM] += 0.35

    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return vec.tolist()


async def generate_embedding(text: str, use_live_api: bool = False) -> List[float]:
    """Generate embedding using OpenAI API in Live mode, or local fallback."""
    settings = get_settings()
    if use_live_api and settings.is_live_ai_available:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url.rstrip('/')}/embeddings",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={"model": settings.openai_embedding_model, "input": text[:6000]},
                )
                resp.raise_for_status()
                data = resp.json()
                return data["data"][0]["embedding"]
        except Exception:
            pass
    return _local_embed_text(text)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if len(a) != len(b):
        return 0.0
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0.0:
        return 0.0
    return float(np.dot(va, vb) / denom)


async def index_knowledge_document(
    db: Session,
    title: str,
    content: str,
    category: str = "general",
    file_name: str | None = None,
    file_type: str = "text",
) -> KnowledgeDocument:
    """Persist a document, chunk it, compute embeddings, and store chunks."""
    chunks_text = split_text_into_chunks(content)
    doc = KnowledgeDocument(
        title=title,
        category=category,
        file_name=file_name,
        file_type=file_type,
        content=content,
        chunk_count=len(chunks_text),
    )
    db.add(doc)
    db.flush()

    settings = get_settings()
    for idx, chunk_text in enumerate(chunks_text):
        emb = await generate_embedding(chunk_text, use_live_api=settings.is_live_ai_available)
        chunk = KnowledgeChunk(
            document_id=doc.id,
            chunk_index=idx,
            content=chunk_text,
            embedding_json=json.dumps(emb),
        )
        db.add(chunk)

    db.commit()
    db.refresh(doc)
    return doc


async def retrieve_relevant_chunks(
    db: Session,
    query: str,
    top_k: int = 4,
    min_score: float = 0.08,
) -> List[Dict[str, Any]]:
    """Retrieve top-k relevant knowledge chunks with source attribution."""
    chunks = db.query(KnowledgeChunk).join(KnowledgeDocument).all()
    if not chunks:
        return []

    settings = get_settings()
    query_tokens = {
        t for t in re.findall(r"[\w\u0900-\u097F]+", query.lower())
        if t not in STOP_WORDS and len(t) > 1
    }
    live_emb = (
        await generate_embedding(query, use_live_api=True)
        if settings.is_live_ai_available
        else None
    )
    local_query_emb = _local_embed_text(query)

    scored: List[Dict[str, Any]] = []
    for chunk in chunks:
        chunk_emb = json.loads(chunk.embedding_json)
        if live_emb and len(live_emb) == len(chunk_emb):
            sim = _cosine_similarity(live_emb, chunk_emb)
        else:
            chunk_local_emb = (
                chunk_emb if len(chunk_emb) == EMBEDDING_DIM else _local_embed_text(chunk.content)
            )
            sim = _cosine_similarity(local_query_emb, chunk_local_emb)

        # Lexical overlap boost with higher weight on title/category matches
        chunk_tokens = set(re.findall(r"[\w\u0900-\u097F]+", chunk.content.lower()))
        title_tokens = set(re.findall(r"[\w\u0900-\u097F]+", f"{chunk.document.title} {chunk.document.category}".lower()))
        body_overlap = len(query_tokens & chunk_tokens)
        title_overlap = len(query_tokens & title_tokens)
        lexical_boost = min(0.45, body_overlap * 0.06 + title_overlap * 0.16)
        final_score = round(sim + lexical_boost, 4)

        if final_score >= min_score:
            scored.append(
                {
                    "document_id": chunk.document_id,
                    "title": chunk.document.title,
                    "category": chunk.document.category,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "score": final_score,
                }
            )

    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored[:top_k]
