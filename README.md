# Live Stream WebSocket to HLS

This project has two parts:

- `frontend/`: static pages for Vercel.
  - `index.html`: streamer page, captures camera/mic and sends WebM chunks over WebSocket.
  - `viewer.html`: viewer page, plays the HLS playlist through `hls.js`.
- `server/`: Node.js backend for an Oracle Cloud Ubuntu VM.
  - Receives WebSocket media chunks at `/stream`.
  - Pipes chunks into FFmpeg over stdin.
  - Writes HLS files into `server/hls`.
  - Serves HLS files over HTTP at `/hls/output.m3u8`.

## Local / VM Requirements

- Node.js 20+
- FFmpeg installed and available as `ffmpeg`

On Ubuntu:

```bash
sudo apt update
sudo apt install -y nodejs npm ffmpeg
```

## Run The Backend

```bash
cd server
npm install
npm start
```

The server listens on port `8080` by default.

Useful endpoints:

- `GET /health`
- `GET /status`
- `WS /stream`
- `GET /hls/output.m3u8`

## Use The Frontend

Open `frontend/index.html` to stream.
Open `frontend/viewer.html` in another browser tab/device to watch.

The frontend uses this production backend URL:

```text
https://98.86.119.71.sslip.io:8080
```

The streamer page automatically converts the backend URL to this WebSocket URL:

```text
wss://98.86.119.71.sslip.io:8080/stream
```

## Deploy Frontend To Vercel

Deploy the `frontend/` directory as a static project.

No frontend build step is required.

## Oracle Firewall Notes

Open the backend port on the VM and in Oracle Cloud security rules:

```bash
sudo ufw allow 8080/tcp
```

Production HTTPS is configured through Nginx. Use:

```text
https://98.86.119.71.sslip.io:8080
```

The frontend will then use:

```text
wss://98.86.119.71.sslip.io:8080/stream
```

Browsers often require HTTPS pages to connect only to secure `wss://` WebSocket endpoints. For a Vercel production frontend, put your VM behind HTTPS if the browser blocks `ws://` mixed content.


## Optional Systemd Service

Copy `server/.env.example` to `server/.env`, edit it, then adapt `server/live-stream.service.example` for your VM paths.

```bash
sudo cp server/live-stream.service.example /etc/systemd/system/live-stream.service
sudo systemctl daemon-reload
sudo systemctl enable --now live-stream
sudo systemctl status live-stream
```
