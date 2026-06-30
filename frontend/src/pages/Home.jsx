import { useEffect, useState } from "react";
import { api } from "../api";
import VideoCard from "../components/VideoCard";
import LiveCard from "../components/LiveCard";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listVideos().then(setVideos).catch((e) => setError(e.message));
    api.liveStreams().then(setLiveStreams).catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="hero">
        <h1>Unlimited content. Stored by you.</h1>
        <p>Upload your library, or go live straight from OBS.</p>
      </div>

      {error && <div className="error">{error}</div>}

      {liveStreams.length > 0 && (
        <section className="row">
          <h2>Live now</h2>
          <div className="grid">
            {liveStreams.map((s) => (
              <LiveCard key={s.id} stream={s} />
            ))}
          </div>
        </section>
      )}

      <section className="row">
        <h2>Browse</h2>
        {videos.length === 0 ? (
          <p className="muted">No videos yet. Be the first to upload one.</p>
        ) : (
          <div className="grid">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
