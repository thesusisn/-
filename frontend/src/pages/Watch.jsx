import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";

export default function Watch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getVideo(id).then(setVideo).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="page error">{error}</div>;
  if (!video) return <div className="page">Loading…</div>;

  return (
    <div className="page watch-page">
      <video className="player" src={api.videoUrl(video.filename)} controls autoPlay />
      <h1>{video.title}</h1>
      <div className="muted">Uploaded by {video.owner_username}</div>
      {video.description && <p>{video.description}</p>}
    </div>
  );
}
