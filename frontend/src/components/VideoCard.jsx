import { Link } from "react-router-dom";
import { api } from "../api";

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export default function VideoCard({ video }) {
  const thumb = api.thumbnailUrl(video.thumbnail_filename);
  return (
    <Link to={`/watch/${video.id}`} className="video-card">
      <div className="video-card-thumb">
        {thumb ? (
          <img src={thumb} alt={video.title} loading="lazy" />
        ) : (
          <div className="video-card-thumb-fallback" />
        )}
        {video.duration_seconds != null && (
          <span className="video-card-duration">{formatDuration(video.duration_seconds)}</span>
        )}
      </div>
      <div className="video-card-info">
        <div className="video-card-title">{video.title}</div>
        <div className="video-card-owner">{video.owner_username}</div>
      </div>
    </Link>
  );
}
