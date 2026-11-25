from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api import ai, analytics, appointments, auth, calls, knowledge, leads, settings as settings_router
from app.core.config import get_settings
from app.db.database import Base, SessionLocal, engine
from app.db.seed import seed_initial_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        await seed_initial_data(db)
    finally:
        db.close()
    yield


app_settings = get_settings()
app = FastAPI(
    title=app_settings.app_name,
    version="1.0.0",
    description="Autonomous AI Sales Voice Agent MVP with RAG, CRM, Lead Scoring, Sentiment Analysis, and Appointment Scheduling.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(calls.router)
app.include_router(appointments.router)
app.include_router(knowledge.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(settings_router.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    s = get_settings()
    return {
        "status": "ok",
        "app": s.app_name,
        "mode": "live" if s.is_live_ai_available else "demo",
        "demo_mode": not s.is_live_ai_available,
    }


FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if (FRONTEND_DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")


@app.get("/favicon.ico", include_in_schema=False)
def favicon_ico():
    svg_path = FRONTEND_DIST / "favicon.svg"
    if svg_path.is_file():
        return FileResponse(svg_path, media_type="image/svg+xml")
    return Response(status_code=204)


@app.get("/favicon.svg", include_in_schema=False)
def favicon_svg():
    svg_path = FRONTEND_DIST / "favicon.svg"
    if svg_path.is_file():
        return FileResponse(svg_path, media_type="image/svg+xml")
    return Response(status_code=204)


@app.get("/", include_in_schema=False)
def root_page():
    index_html = FRONTEND_DIST / "index.html"
    if index_html.is_file():
        return FileResponse(index_html)
    return HTMLResponse(
        "<h2>Fortivex AI Backend Running</h2>"
        "<p>Frontend dev server: <a href='http://127.0.0.1:5173'>http://127.0.0.1:5173</a> | "
        "API Docs: <a href='/docs'>/docs</a></p>"
    )
