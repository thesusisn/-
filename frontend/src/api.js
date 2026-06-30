const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body && !isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  API_URL,
  register: (data) => request("/auth/register", { method: "POST", body: data }),
  login: (data) => request("/auth/login", { method: "POST", body: data }),
  me: () => request("/auth/me"),

  listVideos: () => request("/videos"),
  myVideos: () => request("/videos/mine"),
  getVideo: (id) => request(`/videos/${id}`),
  uploadVideo: (formData) => request("/videos", { method: "POST", body: formData, isForm: true }),
  updateVideo: (id, data) => request(`/videos/${id}`, { method: "PATCH", body: data }),
  deleteVideo: (id) => request(`/videos/${id}`, { method: "DELETE" }),

  liveStreams: () => request("/streams/live"),
  liveStatus: (username) => request(`/streams/live/${username}`),
  regenerateKey: () => request("/streams/key/regenerate", { method: "POST" }),
  updateStreamTitle: (stream_title) =>
    request("/streams/title", { method: "PATCH", body: { stream_title } }),

  videoUrl: (filename) => `${API_URL}/media/videos/${filename}`,
  thumbnailUrl: (filename) => (filename ? `${API_URL}/media/thumbnails/${filename}` : null),
  hlsUrl: (playbackId) => `${API_URL}/media/hls/${playbackId}/index.m3u8`,
};

export function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

export function getStoredToken() {
  return getToken();
}
