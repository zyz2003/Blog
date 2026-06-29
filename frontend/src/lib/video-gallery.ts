export const VIDEO_FIRST_FRAME_FRAGMENT = "#t=0.001";

const FIRST_FRAME_TIME = 0.001;
const MOBILE_VIDEO_PLAYBACK_ATTRIBUTES: Record<string, string> = {
  playsinline: "true",
  "webkit-playsinline": "true",
  "x5-playsinline": "true",
  "x5-video-player-type": "h5",
};

export function withVideoFirstFrameFragment(url: string, poster?: string | null): string {
  if (!url || poster || url.includes("#")) return url;
  return `${url}${VIDEO_FIRST_FRAME_FRAGMENT}`;
}

export function stripVideoFirstFrameFragment(url: string): string {
  return url.endsWith(VIDEO_FIRST_FRAME_FRAGMENT) ? url.slice(0, -VIDEO_FIRST_FRAME_FRAGMENT.length) : url;
}

function canCreateInlinePoster(url: string): boolean {
  if (!url || typeof window === "undefined") return false;
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;

  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function seekToFirstFrame(video: HTMLVideoElement): void {
  try {
    const duration = video.duration;
    const targetTime = Number.isFinite(duration) && duration > 0
      ? Math.min(FIRST_FRAME_TIME, Math.max(0, duration - FIRST_FRAME_TIME))
      : FIRST_FRAME_TIME;

    if (video.currentTime < targetTime) {
      video.currentTime = targetTime;
    }
  } catch {
    // Some mobile browsers reject early seeks before enough metadata is available.
  }
}

function createInlinePosterFromCurrentFrame(video: HTMLVideoElement, url: string): void {
  if (video.getAttribute("poster") || !canCreateInlinePoster(url)) return;
  if (!video.videoWidth || !video.videoHeight) return;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = canvas.toDataURL("image/jpeg", 0.82);
    if (poster.startsWith("data:image/")) {
      video.setAttribute("poster", poster);
    }
  } catch {
    // Cross-origin or not-yet-decoded videos may fail; the seek/load warmup still helps.
  }
}

function warmupMutedPlayback(video: HTMLVideoElement): void {
  if (typeof video.play !== "function" || typeof video.pause !== "function") return;

  const wasMuted = video.muted;
  const wasDefaultMuted = video.defaultMuted;
  const hadMutedAttribute = video.hasAttribute("muted");
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute("muted", "true");

  const restoreMutedState = () => {
    video.muted = wasMuted;
    video.defaultMuted = wasDefaultMuted;
    if (!hadMutedAttribute) {
      video.removeAttribute("muted");
    }
  };

  const pauseAfterFrame = () => {
    video.pause();
    seekToFirstFrame(video);
    restoreMutedState();
  };

  try {
    const playResult = video.play() as Promise<void> | undefined;
    if (!playResult) {
      window.setTimeout(pauseAfterFrame, 120);
      return;
    }

    void playResult
      .then(() => {
        const videoWithFrameCallback = video as HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: () => void) => number;
        };
        if (typeof videoWithFrameCallback.requestVideoFrameCallback === "function") {
          videoWithFrameCallback.requestVideoFrameCallback(pauseAfterFrame);
          return;
        }
        window.setTimeout(pauseAfterFrame, 120);
      })
      .catch(() => {
        restoreMutedState();
      });
  } catch {
    restoreMutedState();
  }
}

function primeVideoFirstFrame(video: HTMLVideoElement, url: string): void {
  if (video.dataset.videoGalleryFirstFramePrimed === "true") return;
  video.dataset.videoGalleryFirstFramePrimed = "true";

  video.setAttribute("preload", "auto");
  Object.entries(MOBILE_VIDEO_PLAYBACK_ATTRIBUTES).forEach(([name, value]) => {
    video.setAttribute(name, value);
  });

  const captureCurrentFrame = () => {
    seekToFirstFrame(video);
    createInlinePosterFromCurrentFrame(video, url);
  };

  video.addEventListener("loadedmetadata", () => {
    seekToFirstFrame(video);
    warmupMutedPlayback(video);
  }, { once: true });
  video.addEventListener("loadeddata", captureCurrentFrame, { once: true });
  video.addEventListener("seeked", captureCurrentFrame, { once: true });
  video.addEventListener("canplay", captureCurrentFrame, { once: true });

  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    seekToFirstFrame(video);
    warmupMutedPlayback(video);
  }
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    captureCurrentFrame();
  }

  try {
    video.load();
  } catch {
    // jsdom and some constrained WebViews may expose load() but reject the call.
  }
}

export function enhanceVideoGalleryFirstFrames(root: ParentNode): void {
  root.querySelectorAll<HTMLVideoElement>(".video-gallery-container video").forEach(video => {
    const poster = video.getAttribute("poster")?.trim();
    Object.entries(MOBILE_VIDEO_PLAYBACK_ATTRIBUTES).forEach(([name, value]) => {
      video.setAttribute(name, value);
    });
    if (poster) return;

    const source = video.querySelector<HTMLSourceElement>("source");
    const videoSrc = video.getAttribute("src") || source?.getAttribute("src") || "";
    const playbackVideoSrc = withVideoFirstFrameFragment(videoSrc);
    if (playbackVideoSrc) {
      video.setAttribute("src", playbackVideoSrc);
    }

    const sourceSrc = source?.getAttribute("src") || "";
    if (source && sourceSrc) {
      source.setAttribute("src", withVideoFirstFrameFragment(sourceSrc));
    }

    primeVideoFirstFrame(video, playbackVideoSrc || videoSrc);
  });
}
