from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    stream_key: str
    is_live: bool
    stream_title: str
    created_at: datetime

    class Config:
        from_attributes = True


class PublicUserOut(BaseModel):
    id: str
    username: str
    is_live: bool
    stream_title: str
    playback_id: str

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class VideoOut(BaseModel):
    id: str
    title: str
    description: str
    filename: str
    thumbnail_filename: Optional[str]
    duration_seconds: Optional[float]
    owner_id: str
    owner_username: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class StreamWebhookPayload(BaseModel):
    stream_key: str
    secret: str
