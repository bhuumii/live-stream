"use strict";
{
    const DEFAULT_SERVER_URL = "https://98.86.119.71.sslip.io:8080";
    const CHUNK_INTERVAL_MS = 250;
    const preview = getElement("#preview");
    const startButton = getElement("#startButton");
    const stopButton = getElement("#stopButton");
    const connectionStatus = getElement("#connectionStatus");
    const cameraStatus = getElement("#cameraStatus");
    const chunksSent = getElement("#chunksSent");
    const liveBadge = getElement("#liveBadge");
    let mediaStream = null;
    let mediaRecorder = null;
    let socket = null;
    let sentChunks = 0;
    startButton.addEventListener("click", startStreaming);
    stopButton.addEventListener("click", () => stopStreaming());
    async function startStreaming() {
        try {
            const serverUrl = DEFAULT_SERVER_URL;
            updateUi({ connection: "Connecting", camera: "Requesting access", live: false });
            startButton.disabled = true;
            mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30, max: 30 },
                },
            });
            preview.srcObject = mediaStream;
            updateUi({ camera: "Ready" });
            socket = await openSocket(toWebSocketUrl(serverUrl));
            updateUi({ connection: "Live", live: true });
            sentChunks = 0;
            chunksSent.textContent = String(sentChunks);
            const mimeType = pickMimeType();
            mediaRecorder = new MediaRecorder(mediaStream, {
                mimeType,
                videoBitsPerSecond: 2_500_000,
                audioBitsPerSecond: 128_000,
            });
            mediaRecorder.addEventListener("dataavailable", (event) => {
                if (!event.data.size || socket?.readyState !== WebSocket.OPEN)
                    return;
                socket.send(event.data);
                sentChunks += 1;
                chunksSent.textContent = String(sentChunks);
            });
            mediaRecorder.addEventListener("stop", () => {
                socket?.readyState === WebSocket.OPEN && socket.close(1000, "stream stopped");
            });
            mediaRecorder.start(CHUNK_INTERVAL_MS);
            stopButton.disabled = false;
        }
        catch (error) {
            console.error(error);
            updateUi({
                connection: error instanceof Error ? error.message : "Could not start",
                camera: "Stopped",
                live: false,
            });
            stopStreaming({ keepStatus: true });
        }
    }
    function stopStreaming({ keepStatus = false } = {}) {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
        }
        if (socket && socket.readyState <= WebSocket.OPEN) {
            socket.close(1000, "stream stopped");
        }
        mediaStream?.getTracks().forEach((track) => track.stop());
        mediaStream = null;
        mediaRecorder = null;
        socket = null;
        preview.srcObject = null;
        startButton.disabled = false;
        stopButton.disabled = true;
        if (!keepStatus) {
            updateUi({ connection: "Idle", camera: "Not requested", live: false });
        }
    }
    function pickMimeType() {
        const options = [
            "video/webm;codecs=vp8,opus",
            "video/webm;codecs=vp9,opus",
            "video/webm",
        ];
        const supported = options.find((type) => MediaRecorder.isTypeSupported(type));
        if (!supported) {
            throw new Error("This browser cannot record WebM through MediaRecorder.");
        }
        return supported;
    }
    function openSocket(url) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            ws.binaryType = "arraybuffer";
            const timeout = window.setTimeout(() => {
                ws.close();
                reject(new Error("WebSocket connection timed out."));
            }, 8000);
            ws.addEventListener("open", () => {
                window.clearTimeout(timeout);
                resolve(ws);
            });
            ws.addEventListener("close", () => {
                if (socket === ws)
                    updateUi({ connection: "Disconnected", live: false });
            });
            ws.addEventListener("error", () => {
                window.clearTimeout(timeout);
                reject(new Error("Could not connect to the streaming server."));
            });
        });
    }
    function toWebSocketUrl(serverUrl) {
        const url = new URL(serverUrl);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.pathname = "/stream";
        url.search = "";
        return url.toString();
    }
    function updateUi({ connection, camera, live } = {}) {
        if (connection)
            connectionStatus.textContent = connection;
        if (camera)
            cameraStatus.textContent = camera;
        if (typeof live === "boolean") {
            liveBadge.textContent = live ? "Live" : "Offline";
            liveBadge.classList.toggle("active", live);
        }
    }
    function getElement(selector) {
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`Missing element: ${selector}`);
        }
        return element;
    }
}
