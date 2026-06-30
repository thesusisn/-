from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import HLS_DIR, THUMBNAILS_DIR, VIDEOS_DIR
from app.database import Base, engine
from app.routers import auth, streams, videos

Base.metadata.create_all(bind=engine)

app = FastAPI(title="StreamFlix API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(streams.router)

app.mount("/media/videos", StaticFiles(directory=VIDEOS_DIR), name="videos")
app.mount("/media/thumbnails", StaticFiles(directory=THUMBNAILS_DIR), name="thumbnails")
app.mount("/media/hls", StaticFiles(directory=HLS_DIR), name="hls")


@app.get("/health")
def health():
    return {"status": "ok"}
