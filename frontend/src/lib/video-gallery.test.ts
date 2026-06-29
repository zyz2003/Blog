import { describe, expect, it, vi } from "vitest";
import { enhanceVideoGalleryFirstFrames, stripVideoFirstFrameFragment } from "@/lib/video-gallery";

describe("video gallery helpers", () => {
  it("adds first-frame fragments to legacy videos without posters", async () => {
    vi.useFakeTimers();
    const loadSpy = vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

    try {
      const root = document.createElement("div");
      root.innerHTML = `
        <div class="video-gallery-container">
          <div class="video-gallery-item">
            <div class="video-gallery-video-wrapper">
              <video class="video-gallery-video" src="/media/demo.mp4?token=abc">
                <source src="/media/demo.mp4?token=abc" type="video/mp4" />
              </video>
            </div>
          </div>
          <div class="video-gallery-item">
            <div class="video-gallery-video-wrapper">
              <video class="video-gallery-video" src="/media/covered.mp4" poster="/media/covered.jpg">
                <source src="/media/covered.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      `;

      enhanceVideoGalleryFirstFrames(root);

      const [videoWithoutPoster, videoWithPoster] = Array.from(root.querySelectorAll("video"));
      const sourceWithoutPoster = videoWithoutPoster.querySelector("source");
      const sourceWithPoster = videoWithPoster.querySelector("source");

      expect(videoWithoutPoster.getAttribute("src")).toBe("/media/demo.mp4?token=abc#t=0.001");
      expect(sourceWithoutPoster?.getAttribute("src")).toBe("/media/demo.mp4?token=abc#t=0.001");
      expect(videoWithoutPoster.getAttribute("preload")).toBe("auto");
      expect(videoWithoutPoster.getAttribute("playsinline")).toBe("true");
      expect(videoWithoutPoster.dataset.videoGalleryFirstFramePrimed).toBe("true");
      expect(loadSpy).toHaveBeenCalledTimes(1);

      videoWithoutPoster.dispatchEvent(new Event("loadedmetadata"));
      expect(videoWithoutPoster.currentTime).toBeCloseTo(0.001);
      expect(videoWithoutPoster.getAttribute("muted")).toBe("true");
      expect(playSpy).toHaveBeenCalledTimes(1);

      expect(videoWithPoster.getAttribute("src")).toBe("/media/covered.mp4");
      expect(sourceWithPoster?.getAttribute("src")).toBe("/media/covered.mp4");
      expect(videoWithPoster.getAttribute("playsinline")).toBe("true");
      expect(videoWithPoster.dataset.videoGalleryFirstFramePrimed).toBeUndefined();

      await Promise.resolve();
      vi.advanceTimersByTime(120);
      expect(pauseSpy).toHaveBeenCalledTimes(1);
      expect(videoWithoutPoster.muted).toBe(false);
      expect(videoWithoutPoster.hasAttribute("muted")).toBe(false);
    } finally {
      loadSpy.mockRestore();
      playSpy.mockRestore();
      pauseSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("strips internal first-frame fragments before saving markdown", () => {
    expect(stripVideoFirstFrameFragment("/media/demo.mp4#t=0.001")).toBe("/media/demo.mp4");
    expect(stripVideoFirstFrameFragment("/media/demo.mp4#intro")).toBe("/media/demo.mp4#intro");
  });
});
