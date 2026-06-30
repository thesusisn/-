from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import RTMP_WEBHOOK_SECRET
from app.database import get_db
from app.models import User, gen_stream_key
from app.schemas import PublicUserOut, StreamWebhookPayload, UserOut
from app.security import get_current_user

router = APIRouter(prefix="/streams", tags=["streams"])


class StreamTitleUpdate(BaseModel):
    stream_title: str


@router.get("/live", response_model=List[PublicUserOut])
def list_live_streams(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_live == True).all()  # noqa: E712
    return [PublicUserOut.model_validate(u) for u in users]


@router.get("/live/{username}", response_model=PublicUserOut)
def get_live_status(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return PublicUserOut.model_validate(user)


@router.post("/key/regenerate", response_model=UserOut)
def regenerate_stream_key(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    current_user.stream_key = gen_stream_key()
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.patch("/title", response_model=UserOut)
def update_stream_title(
    payload: StreamTitleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.stream_title = payload.stream_title
    db.commit()
    db.refresh(current_user)
    return UserOut.model_validate(current_user)


def _check_webhook_secret(payload: StreamWebhookPayload):
    if payload.secret != RTMP_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")


@router.post("/webhook/publish")
def webhook_publish(payload: StreamWebhookPayload, db: Session = Depends(get_db)):
    _check_webhook_secret(payload)
    user = db.query(User).filter(User.stream_key == payload.stream_key).first()
    if not user:
        raise HTTPException(status_code=403, detail="Unknown stream key")
    user.is_live = True
    db.commit()
    return {"ok": True, "username": user.username, "user_id": user.id}


@router.post("/webhook/done")
def webhook_done(payload: StreamWebhookPayload, db: Session = Depends(get_db)):
    _check_webhook_secret(payload)
    user = db.query(User).filter(User.stream_key == payload.stream_key).first()
    if not user:
        return {"ok": False}
    user.is_live = False
    db.commit()
    return {"ok": True}
