import { beforeAll, describe, expect, it } from "vitest";
import { marked } from "marked";
import { registerMarkedExtensions } from "@/lib/marked-extensions";

beforeAll(() => {
  registerMarkedExtensions(marked);
});

describe("marked video gallery extension", () => {
  it("adds a first-frame fragment for mobile browsers when poster is missing", () => {
    const html = marked.parse(
      `:::video-gallery
url=/static/video-mobile.mp4?token=abc title=移动端 type=video/mp4
:::`,
      { async: false },
    ) as string;

    expect(html).toContain('src="/static/video-mobile.mp4?token=abc#t=0.001"');
    expect(html).toContain('<source src="/static/video-mobile.mp4?token=abc#t=0.001" type="video/mp4" />');
    expect(html).not.toContain('poster=""');
  });

  it("renders published video gallery with article detail styling contract", () => {
    const html = marked.parse(
      `:::video-gallery cols=2 gap=20px ratio=16:9
url=/static/video-a.mp4 poster=/static/video-a.jpg title=视频A desc=第一段 type=video/mp4
url=/static/video-b.webm title=视频B desc=第二段 type=video/webm
:::`,
      { async: false },
    ) as string;

    expect(html).toContain("video-gallery-container video-gallery-cols-2 video-gallery-count-2");
    expect(html).toContain('style="gap:20px;--video-gallery-ratio:56.25%;"');
    expect(html).toContain('<div class="video-gallery-video-wrapper">');
    expect(html).toContain(
      '<video class="video-gallery-video" controls preload="metadata" playsinline webkit-playsinline="true" x5-playsinline="true" x5-video-player-type="h5" src="/static/video-a.mp4" poster="/static/video-a.jpg">',
    );
    expect(html).toContain(
      '<video class="video-gallery-video" controls preload="metadata" playsinline webkit-playsinline="true" x5-playsinline="true" x5-video-player-type="h5" src="/static/video-b.webm#t=0.001">',
    );
    expect(html).toContain('<source src="/static/video-a.mp4" type="video/mp4" />');
    expect(html).toContain('<source src="/static/video-b.webm#t=0.001" type="video/webm" />');
    expect(html).toContain('<div class="video-gallery-caption"><div class="video-gallery-title">视频A</div><div class="video-gallery-desc">第一段</div></div>');
    expect(html).toContain('<div class="video-gallery-caption"><div class="video-gallery-title">视频B</div><div class="video-gallery-desc">第二段</div></div>');
  });
});
