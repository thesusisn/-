import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import HlsPlayer from "../components/HlsPlayer";

export default function LiveWatch() {
  const { username } = useParams();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => api.liveStatus(username).then(setStatus).catch((e) => setError(e.message));
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [username]);

  if (error) return <div className="page error">{error}</div>;
  if (!status) return <div className="page">Loading…</div>;

  return (
    <div className="page watch-page">
      {status.is_live ? (
        <HlsPlayer src={api.hlsUrl(status.playback_id)} />
      ) : (
        <div className="offline-banner">{username} is currently offline.</div>
      )}
      <h1>{status.stream_title || `${username}'s stream`}</h1>
      <div className="muted">{username}</div>
    </div>
  );
}
