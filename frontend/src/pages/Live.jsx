import { useEffect, useState } from "react";
import { api } from "../api";
import LiveCard from "../components/LiveCard";

export default function Live() {
  const [streams, setStreams] = useState([]);

  useEffect(() => {
    const load = () => api.liveStreams().then(setStreams).catch(() => {});
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page">
      <h1>Live channels</h1>
      {streams.length === 0 ? (
        <p className="muted">Nobody is live right now. Check your dashboard for your stream key and go live from OBS.</p>
      ) : (
        <div className="grid">
          {streams.map((s) => (
            <LiveCard key={s.id} stream={s} />
          ))}
        </div>
      )}
    </div>
  );
}
