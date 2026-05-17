import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.orchestrator import router
from voice.speechmatics import router as voice_router
from ws.websocket import router as ws_router

app = FastAPI(title="TraceGrid AI v3")

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials="*" not in allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(voice_router)
app.include_router(ws_router)
