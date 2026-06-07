"use strict";
{
    const DEFAULT_SERVER_URL = "https://98.86.119.71.sslip.io:8080";
    const player = getElement("#player");
    const watchButton = getElement("#watchButton");
    const reloadButton = getElement("#reloadButton");
    const playbackStatus = getElement("#playbackStatus");
    const playlistUrlLabel = getElement("#playlistUrl");
    const liveBadge = getElement("#liveBadge");
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
            const Hls = getHls();
            if (!Hls?.isSupported()) {
                throw new Error("This browser does not support HLS playback.");
            }
            const currentHls = new Hls({
                liveSyncDurationCount: 2,
                lowLatencyMode: true,
                maxLiveSyncPlaybackRate: 1.2,
            });
            hls = currentHls;
            currentHls.on(Hls.Events.MANIFEST_PARSED, async () => {
                await player.play();
                setLive();
            });
            currentHls.on(Hls.Events.ERROR, (_event, data) => {
                playbackStatus.textContent = data.fatal ? "Stream unavailable" : "Buffering";
                if (data.fatal) {
                    setTimeout(loadStream, 2000);
                }
            });
            currentHls.loadSource(playlistUrl);
            currentHls.attachMedia(player);
        }
        catch (error) {
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
    function getElement(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`Missing element: ${selector}`);
        }
        return element;
    }
    function getHls() {
        return window.Hls;
    }
}
