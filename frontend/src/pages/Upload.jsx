import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Upload() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Choose a video file");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("file", file);
      const video = await api.uploadVideo(formData);
      navigate(`/watch/${video.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="page">
      <form className="upload-form" onSubmit={handleSubmit}>
        <h1>Upload a video</h1>
        {error && <div className="error">{error}</div>}
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
        <input
          type="file"
          accept=".mp4,.mov,.mkv,.webm,.avi"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />
        <button type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
