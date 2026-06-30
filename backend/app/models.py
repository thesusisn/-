import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


def gen_stream_key() -> str:
    return secrets.token_hex(16)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    stream_key = Column(String, unique=True, index=True, default=gen_stream_key)
    is_live = Column(Boolean, default=False)
    stream_title = Column(String, default="")

    videos = relationship("Video", back_populates="owner", cascade="all, delete-orphan")

    @property
    def playback_id(self) -> str:
        """Public, non-secret identifier used for live HLS playback paths.

        Distinct from stream_key, which is the private RTMP publish credential.
        """
        return self.id


class Video(Base):
    __tablename__ = "videos"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    filename = Column(String, nullable=False)
    thumbnail_filename = Column(String, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="videos")
