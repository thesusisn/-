# Deploying

The app needs a real server with: a raw TCP port for RTMP (1935) and
persistent disk for the SQLite DB + uploaded videos + HLS segments. Serverless
platforms (Vercel, Netlify, Cloudflare Pages) won't work for this. A small VPS
does.

## 1. Get a server

[Hetzner Cloud](https://www.hetzner.com/cloud/) CX22 (~€4.20/mo, 2 vCPU/4GB
RAM/40GB disk) is good value for ffmpeg transcoding headroom. Any Ubuntu
22.04+ VPS works the same way (DigitalOcean, Linode, Vultr, etc).

When creating it:
- Image: Ubuntu 22.04 or 24.04
- Add your SSH key
- Note the server's public IPv4 address

## 2. Install Docker

SSH in, then:

```bash
curl -fsSL https://get.docker.com | sh
```

## 3. Open firewall ports

You need 80 (web), 1935 (RTMP), and 22 (SSH) reachable. If using Hetzner's
Cloud Firewall (or `ufw`), allow those three and nothing else.

```bash
ufw allow 22
ufw allow 80
ufw allow 1935
ufw enable
```

## 4. Clone and configure

```bash
git clone <your-repo-url> streamflix
cd streamflix
git checkout claude/video-storage-live-streaming-q5ov46
cp .env.example .env
```

Edit `.env`:
- `SECRET_KEY` / `RTMP_WEBHOOK_SECRET` — generate each with `openssl rand -hex 32`
- `PUBLIC_RTMP_URL` — `rtmp://<your-server-ip>:1935/live` (or your domain once DNS is set up)

## 5. Build and run

```bash
docker compose up -d --build
```

This builds and starts three containers: `backend` (FastAPI, internal only),
`rtmp-server` (RTMP ingest + ffmpeg transcode, port 1935), and `frontend`
(nginx serving the built React app and reverse-proxying API/media calls to
the backend, port 80).

Visit `http://<your-server-ip>` — you should see the site. Sign up, go to
`/dashboard`, and OBS's "Server" field will show the `PUBLIC_RTMP_URL` you set.

## 6. (Optional) domain + HTTPS

Point a domain's A record at the server IP, then put
[Caddy](https://caddyhq.com) or `certbot` + nginx in front for automatic
HTTPS. Browsers don't require HTTPS for `<video>`/HLS playback, but it avoids
mixed-content issues and lets you use camera/clipboard APIs if you add them
later. RTMP itself stays plain TCP either way — OBS doesn't speak TLS to port
1935 in this setup.

## Updating after a code change

```bash
git pull
docker compose up -d --build
```

The named volume `backend_data` (DB, uploads, HLS) persists across rebuilds.

## Logs / troubleshooting

```bash
docker compose logs -f backend
docker compose logs -f rtmp-server
docker compose logs -f frontend
```
