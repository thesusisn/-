import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";

const RTMP_URL = import.meta.env.VITE_RTMP_URL || "rtmp://localhost:1935/live";

export default function Dashboard() {
  const { user, setUser } = useAuth();
  const [myVideos, setMyVideos] = useState([]);
  const [streamTitle, setStreamTitle] = useState(user?.stream_title || "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    api.myVideos().then(setMyVideos).catch((e) => setError(e.message));
  }, []);

  async function handleRegenerate() {
    if (!confirm("Regenerate your stream key? Your OBS settings will need to be updated.")) return;
    try {
      const updated = await api.regenerateKey();
      setUser(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleTitleSave(e) {
    e.preventDefault();
    try {
      const updated = await api.updateStreamTitle(streamTitle);
      setUser(updated);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this video?")) return;
    try {
      await api.deleteVideo(id);
      setMyVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  function copy(text, label) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  }

  if (!user) return null;

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <h2>Go live from OBS</h2>
        <p className="muted">
          In OBS, go to Settings → Stream, choose "Custom…", and paste these values.
        </p>
        <div className="field-row">
          <label>Server</label>
          <code>{RTMP_URL}</code>
          <button type="button" onClick={() => copy(RTMP_URL, "server")}>
            {copied === "server" ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="field-row">
          <label>Stream key</label>
          <code>{user.stream_key}</code>
          <button type="button" onClick={() => copy(user.stream_key, "key")}>
            {copied === "key" ? "Copied" : "Copy"}
          </button>
        </div>
        <button type="button" className="danger" onClick={handleRegenerate}>
          Regenerate stream key
        </button>

        <form className="field-row" onSubmit={handleTitleSave} style={{ marginTop: "1rem" }}>
          <label>Stream title</label>
          <input value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} />
          <button type="submit">Save</button>
        </form>

        <p className="muted">
          {user.is_live ? (
            <>
              You are live now —{" "}
              <Link to={`/live/${user.username}`}>watch your stream</Link>
            </>
          ) : (
            "You are currently offline."
          )}
        </p>
      </section>

      <section className="panel">
        <h2>My uploads</h2>
        {myVideos.length === 0 ? (
          <p className="muted">You haven't uploaded anything yet.</p>
        ) : (
          <ul className="my-video-list">
            {myVideos.map((v) => (
              <li key={v.id}>
                <Link to={`/watch/${v.id}`}>{v.title}</Link>
                <button type="button" className="danger" onClick={() => handleDelete(v.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
