import { Link } from "react-router-dom";

export default function LiveCard({ stream }) {
  return (
    <Link to={`/live/${stream.username}`} className="video-card">
      <div className="video-card-thumb live-card-thumb">
        <span className="live-badge">LIVE</span>
      </div>
      <div className="video-card-info">
        <div className="video-card-title">{stream.stream_title || `${stream.username}'s stream`}</div>
        <div className="video-card-owner">{stream.username}</div>
      </div>
    </Link>
  );
}
