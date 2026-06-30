import shutil
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import ALLOWED_VIDEO_EXTENSIONS, THUMBNAILS_DIR, VIDEOS_DIR
from app.database import get_db
from app.media import generate_thumbnail, probe_duration
from app.models import User, Video
from app.schemas import VideoOut, VideoUpdate
from app.security import get_current_user

router = APIRouter(prefix="/videos", tags=["videos"])


def _to_out(video: Video) -> VideoOut:
    out = VideoOut.model_validate(video)
    out.owner_username = video.owner.username if video.owner else None
    return out


@router.get("", response_model=List[VideoOut])
def list_videos(db: Session = Depends(get_db)):
    videos = db.query(Video).order_by(Video.created_at.desc()).all()
    return [_to_out(v) for v in videos]


@router.get("/mine", response_model=List[VideoOut])
def list_my_videos(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    videos = (
        db.query(Video)
        .filter(Video.owner_id == current_user.id)
        .order_by(Video.created_at.desc())
        .all()
    )
    return [_to_out(v) for v in videos]


@router.get("/{video_id}", response_model=VideoOut)
def get_video(video_id: str, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return _to_out(video)


@router.post("", response_model=VideoOut, status_code=status.HTTP_201_CREATED)
async def upload_video(
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))}",
        )

    stored_filename = f"{uuid.uuid4()}{ext}"
    dest_path = VIDEOS_DIR / stored_filename
    with dest_path.open("wb") as out_file:
        shutil.copyfileobj(file.file, out_file)

    thumbnail_filename: Optional[str] = None
    thumb_path = THUMBNAILS_DIR / f"{Path(stored_filename).stem}.jpg"
    if generate_thumbnail(dest_path, thumb_path):
        thumbnail_filename = thumb_path.name

    duration = probe_duration(dest_path)

    video = Video(
        title=title,
        description=description,
        filename=stored_filename,
        thumbnail_filename=thumbnail_filename,
        duration_seconds=duration,
        owner_id=current_user.id,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return _to_out(video)


@router.patch("/{video_id}", response_model=VideoOut)
def update_video(
    video_id: str,
    payload: VideoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your video")

    if payload.title is not None:
        video.title = payload.title
    if payload.description is not None:
        video.description = payload.description

    db.commit()
    db.refresh(video)
    return _to_out(video)


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_video(
    video_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your video")

    video_path = VIDEOS_DIR / video.filename
    video_path.unlink(missing_ok=True)
    if video.thumbnail_filename:
        (THUMBNAILS_DIR / video.thumbnail_filename).unlink(missing_ok=True)

    db.delete(video)
    db.commit()
    return None
