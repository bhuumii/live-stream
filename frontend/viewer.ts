{
  const DEFAULT_SERVER_URL = "https://98.86.119.71.sslip.io:8080";

  interface HlsErrorData {
    fatal: boolean;
  }

  interface HlsInstance {
    on(event: string, listener: (event: string, data: HlsErrorData) => void): void;
    loadSource(source: string): void;
    attachMedia(media: HTMLMediaElement): void;
    destroy(): void;
  }

  interface HlsConstructor {
    new (config: {
      liveSyncDurationCount: number;
      lowLatencyMode: boolean;
      maxLiveSyncPlaybackRate: number;
    }): HlsInstance;
    isSupported(): boolean;
    Events: {
      MANIFEST_PARSED: string;
      ERROR: string;
    };
  }

  interface Window {
    Hls?: HlsConstructor;
  }

  const player = getElement<HTMLVideoElement>("#player");
  const watchButton = getElement<HTMLButtonElement>("#watchButton");
  const reloadButton = getElement<HTMLButtonElement>("#reloadButton");
  const playbackStatus = getElement<HTMLElement>("#playbackStatus");
  const playlistUrlLabel = getElement<HTMLElement>("#playlistUrl");
  const liveBadge = getElement<HTMLElement>("#liveBadge");

  let hls: HlsInstance | null = null;

  watchButton.addEventListener("click", loadStream);
  reloadButton.addEventListener("click", loadStream);

  async function loadStream(): Promise<void> {
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
    } catch (error) {
      console.error(error);
      playbackStatus.textContent = error instanceof Error ? error.message : "Could not load";
    }
  }

  function destroyHls(): void {
    if (hls) {
      hls.destroy();
      hls = null;
    }

    player.removeAttribute("src");
    player.load();
  }

  function setLive(): void {
    playbackStatus.textContent = "Playing live";
    liveBadge.textContent = "Live";
    liveBadge.classList.add("active");
  }

  function getElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing element: ${selector}`);
    }
    return element;
  }

  function getHls(): HlsConstructor | undefined {
    return (window as Window & { Hls?: HlsConstructor }).Hls;
  }
}
