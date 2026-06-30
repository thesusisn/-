const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const NodeMediaServer = require("node-media-server");
const fetch = require("node-fetch");

const RTMP_PORT = parseInt(process.env.RTMP_PORT || "1935", 10);
const HTTP_PORT = parseInt(process.env.RTMP_HTTP_PORT || "8001", 10);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const WEBHOOK_SECRET = process.env.RTMP_WEBHOOK_SECRET || "dev-rtmp-webhook-secret";
const HLS_DIR = process.env.HLS_DIR || path.join(__dirname, "..", "backend", "storage", "hls");

fs.mkdirSync(HLS_DIR, { recursive: true });

const nms = new NodeMediaServer({
  rtmp: { port: RTMP_PORT },
  http: { port: HTTP_PORT },
});

/** @type {Map<string, import("child_process").ChildProcess>} */
const ffmpegProcesses = new Map();

async function callWebhook(endpoint, streamKey) {
  const resp = await fetch(`${BACKEND_URL}/streams/webhook/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stream_key: streamKey, secret: WEBHOOK_SECRET }),
  });
  return resp;
}

function startTranscode(streamKey, playbackId) {
  const outDir = path.join(HLS_DIR, playbackId);
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) {
    fs.unlinkSync(path.join(outDir, f));
  }

  const args = [
    "-fflags", "nobuffer",
    "-i", `rtmp://127.0.0.1:${RTMP_PORT}/live/${streamKey}`,
    "-c:v", "copy",
    "-c:a", "aac", "-ar", "44100", "-b:a", "128k",
    "-f", "hls",
    "-hls_time", "2",
    "-hls_list_size", "10",
    "-hls_flags", "delete_segments+append_list+omit_endlist",
    "-hls_segment_filename", path.join(outDir, "seg_%03d.ts"),
    path.join(outDir, "index.m3u8"),
  ];

  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  proc.stderr.on("data", () => {});
  proc.on("exit", (code) => {
    console.log(`[ffmpeg] transcode for ${streamKey} exited with code ${code}`);
    ffmpegProcesses.delete(streamKey);
  });

  ffmpegProcesses.set(streamKey, proc);
  console.log(`[ffmpeg] started HLS transcode for stream key ${streamKey}`);
}

function stopTranscode(streamKey) {
  const proc = ffmpegProcesses.get(streamKey);
  if (proc) {
    proc.kill("SIGTERM");
    ffmpegProcesses.delete(streamKey);
  }
}

nms.on("prePublish", async (session) => {
  const streamKey = session.streamName;
  try {
    const resp = await callWebhook("publish", streamKey);
    if (!resp.ok) {
      console.log(`[auth] rejecting publish for invalid stream key: ${streamKey}`);
      session.close();
      return;
    }
    const data = await resp.json();
    console.log(`[auth] stream started for user ${data.username} (key ${streamKey})`);
    startTranscode(streamKey, data.user_id);
  } catch (err) {
    console.error("[auth] webhook error, rejecting publish:", err.message);
    session.close();
  }
});

nms.on("donePublish", async (session) => {
  const streamKey = session.streamName;
  stopTranscode(streamKey);
  try {
    await callWebhook("done", streamKey);
  } catch (err) {
    console.error("[auth] done webhook error:", err.message);
  }
  console.log(`[auth] stream ended for key ${streamKey}`);
});

nms.run();
console.log(`RTMP server listening on rtmp://0.0.0.0:${RTMP_PORT}/live/<stream_key>`);
console.log(`HLS output directory: ${HLS_DIR}`);
