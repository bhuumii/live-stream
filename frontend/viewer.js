const DEFAULT_SERVER_URL = "http://localhost:8080";
const SERVER_STORAGE_KEY = "live-stream-server-url";

const player = document.querySelector("#player");
const serverUrlInput = document.querySelector("#serverUrl");
const watchButton = document.querySelector("#watchButton");
const reloadButton = document.querySelector("#reloadButton");
const playbackStatus = document.querySelector("#playbackStatus");
const playlistUrlLabel = document.querySelector("#playlistUrl");
const liveBadge = document.querySelector("#liveBadge");

let hls = null;

serverUrlInput.value = localStorage.getItem(SERVER_STORAGE_KEY) || DEFAULT_SERVER_URL;

watchButton.addEventListener("click", loadStream);
reloadButton.addEventListener("click", loadStream);

async function loadStream() {
  try {
    const serverUrl = normalizeHttpUrl(serverUrlInput.value);
    localStorage.setItem(SERVER_STORAGE_KEY, serverUrl);

    const playlistUrl = `${serverUrl}/hls/output.m3u8?cache=${Date.now()}`;
    playlistUrlLabel.textContent = playlistUrl;
    playbackStatus.textContent = "Loading";
    liveBadge.textContent = "Waiting";
    liveBadge.classList.remove("active");

    destroyHls();

    if (player.canPlayType("application/vnd.apple.mpegurl")) {
      player.src = playlistUrl;
      await player.play();
      setLive();
      return;
    }

    if (!window.Hls?.isSupported()) {
      throw new Error("This browser does not support HLS playback.");
    }

    hls = new window.Hls({
      liveSyncDurationCount: 2,
      lowLatencyMode: true,
      maxLiveSyncPlaybackRate: 1.2,
    });

    hls.on(window.Hls.Events.MANIFEST_PARSED, async () => {
      await player.play();
      setLive();
    });

    hls.on(window.Hls.Events.ERROR, (_event, data) => {
      playbackStatus.textContent = data.fatal ? "Stream unavailable" : "Buffering";
      if (data.fatal) {
        setTimeout(loadStream, 2000);
      }
    });

    hls.loadSource(playlistUrl);
    hls.attachMedia(player);
  } catch (error) {
    console.error(error);
    playbackStatus.textContent = error instanceof Error ? error.message : "Could not load";
  }
}

function destroyHls() {
  if (hls) {
    hls.destroy();
    hls = null;
  }

  player.removeAttribute("src");
  player.load();
}

function normalizeHttpUrl(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Enter the backend server URL.");

  const url = new URL(trimmed);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Server URL must start with http:// or https://.");
  }

  return url.toString().replace(/\/+$/, "");
}

function setLive() {
  playbackStatus.textContent = "Playing live";
  liveBadge.textContent = "Live";
  liveBadge.classList.add("active");
}
