const DEFAULT_SERVER_URL = "https://98.86.119.71.sslip.io:8080";

const player = document.querySelector("#player");
const watchButton = document.querySelector("#watchButton");
const reloadButton = document.querySelector("#reloadButton");
const playbackStatus = document.querySelector("#playbackStatus");
const playlistUrlLabel = document.querySelector("#playlistUrl");
const liveBadge = document.querySelector("#liveBadge");

let hls = null;


watchButton.addEventListener("click", loadStream);
reloadButton.addEventListener("click", loadStream);

async function loadStream() {
  try {
    const serverUrl = DEFAULT_SERVER_URL;

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

function setLive() {
  playbackStatus.textContent = "Playing live";
  liveBadge.textContent = "Live";
  liveBadge.classList.add("active");
}
