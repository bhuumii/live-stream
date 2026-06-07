import cors from "cors";
import express, { type Response } from "express";
import { spawn } from "node:child_process";
import type { ChildProcessByStdio } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const hlsDir = process.env.HLS_DIR || path.join(rootDir, "hls");
const port = Number(process.env.PORT || 8080);
const segmentName = path.join(hlsDir, "segment_%05d.ts");
const playlistPath = path.join(hlsDir, "output.m3u8");

type FfmpegProcess = ChildProcessByStdio<Writable, null, Readable>;

interface ActiveStream {
  socket: WebSocket;
  ffmpeg: FfmpegProcess;
}

let activeStream: ActiveStream | null = null;
let startedAt: string | null = null;

await mkdir(hlsDir, { recursive: true });

const app = express();
app.disable("x-powered-by");
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/status", (_request, response) => {
  response.json({
    live: Boolean(activeStream),
    startedAt,
    playlist: "/hls/output.m3u8",
  });
});

app.use(
  "/hls",
  express.static(hlsDir, {
    etag: false,
    lastModified: false,
    setHeaders(response: Response) {
      response.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
      response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");
    },
  }),
);

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/stream" });

wss.on("connection", async (socket) => {
  if (activeStream) {
    socket.close(1013, "Another stream is already active.");
    return;
  }

  try {
    await cleanHlsDirectory();
  } catch (error) {
    console.error("Could not clean HLS directory:", error);
    socket.close(1011, "Server could not prepare stream output.");
    return;
  }

  const ffmpeg = startFfmpeg();
  activeStream = { socket, ffmpeg };
  startedAt = new Date().toISOString();

  socket.on("message", (chunk) => {
    if (!ffmpeg.stdin.writable) return;
    ffmpeg.stdin.write(chunk);
  });

  socket.on("close", () => {
    stopActiveStream(socket);
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error);
    stopActiveStream(socket);
  });

  ffmpeg.on("close", (code, signal) => {
    console.log(`FFmpeg exited with code=${code} signal=${signal}`);
    if (activeStream?.ffmpeg === ffmpeg) {
      activeStream?.socket.close(1011, "FFmpeg stopped.");
      activeStream = null;
      startedAt = null;
    }
  });

  console.log("Streamer connected.");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Live stream server listening on http://0.0.0.0:${port}`);
  console.log(`Serving HLS from ${hlsDir}`);
});

function startFfmpeg(): FfmpegProcess {
  const args = [
    "-hide_banner",
    "-loglevel",
    process.env.FFMPEG_LOG_LEVEL || "warning",
    "-fflags",
    "nobuffer",
    "-flags",
    "low_delay",
    "-f",
    "webm",
    "-i",
    "pipe:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-r",
    "30",
    "-g",
    "30",
    "-keyint_min",
    "30",
    "-sc_threshold",
    "0",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ar",
    "44100",
    "-f",
    "hls",
    "-hls_time",
    "1",
    "-hls_list_size",
    "6",
    "-hls_flags",
    "delete_segments+append_list+omit_endlist+program_date_time",
    "-hls_segment_filename",
    segmentName,
    playlistPath,
  ];

  const ffmpeg = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, {
    stdio: ["pipe", "ignore", "pipe"],
  });

  ffmpeg.stderr.on("data", (data: Buffer) => {
    console.error(`ffmpeg: ${data.toString().trim()}`);
  });

  ffmpeg.on("error", (error) => {
    console.error("Could not start FFmpeg:", error);
  });

  return ffmpeg;
}

async function cleanHlsDirectory(): Promise<void> {
  await mkdir(hlsDir, { recursive: true });
  const entries = await readdir(hlsDir, { withFileTypes: true });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && (entry.name.endsWith(".m3u8") || entry.name.endsWith(".ts")))
      .map((entry) => rm(path.join(hlsDir, entry.name), { force: true })),
  );
}

function stopActiveStream(socket: WebSocket): void {
  if (!activeStream || activeStream.socket !== socket) return;

  const { ffmpeg } = activeStream;
  activeStream = null;
  startedAt = null;

  if (ffmpeg.stdin.writable) {
    ffmpeg.stdin.end();
  }

  setTimeout(() => {
    if (!ffmpeg.killed) {
      ffmpeg.kill("SIGTERM");
    }
  }, 1500);

  console.log("Streamer disconnected.");
}
