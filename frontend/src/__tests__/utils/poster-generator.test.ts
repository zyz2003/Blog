import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generatePoster } from "@/utils/poster-generator";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,qr"),
  },
}));

type MockCanvasContext = Partial<CanvasRenderingContext2D> & {
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  lineWidth: number;
};

function createMockCanvasContext(): MockCanvasContext {
  return {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "top",
    lineWidth: 1,
    createLinearGradient: vi.fn(
      () =>
        ({
          addColorStop: vi.fn(),
        }) as unknown as CanvasGradient
    ),
    fillRect: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 20 }) as TextMetrics),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
  };
}

describe("generatePoster", () => {
  let loadedImageSources: string[];
  let context: MockCanvasContext;

  beforeEach(() => {
    loadedImageSources = [];
    context = createMockCanvasContext();

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,poster");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("proxy unavailable");
      })
    );

    class MockImage {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 120;
      height = 120;
      naturalWidth = 120;
      naturalHeight = 120;

      set src(value: string) {
        loadedImageSources.push(value);
        queueMicrotask(() => {
          if (value.startsWith("data:") || value.startsWith("blob:")) {
            this.onload?.();
            return;
          }
          this.onerror?.();
        });
      }
    }

    vi.stubGlobal("Image", MockImage);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("跨域图片代理失败时不回退到 Image 元素加载，避免污染 canvas", async () => {
    await expect(
      generatePoster({
        title: "跨域图片海报",
        description: "封面和头像代理失败时应降级占位，而不是让 canvas 导出失败。",
        author: "作者",
        authorAvatar: "https://resources.olei.me/avatar.png",
        articleUrl: "https://iicats.com/posts/VJU7",
        coverImage: "https://resources.olei.me/cover.png",
      })
    ).resolves.toBe("data:image/png;base64,poster");

    const imageElementProxyLoads = loadedImageSources.filter(source => source.includes("/api/proxy/download?"));

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/proxy/download?url="), expect.any(Object));
    expect(imageElementProxyLoads).toEqual([]);
    expect(loadedImageSources).toContain("data:image/png;base64,qr");
  });

  it("代理失败时仍可用 CORS 读取真实跨域封面生成海报", async () => {
    const coverUrl = "https://resources.olei.me/iicats/1778299161243386156.png";
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:poster-cover");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async input => {
        const requestedUrl = String(input);
        if (requestedUrl.includes("/api/proxy/download?")) {
          throw new TypeError("proxy unavailable");
        }
        if (requestedUrl === coverUrl) {
          return new Response(new Blob(["png"], { type: "image/png" }), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }
        throw new Error(`unexpected fetch: ${requestedUrl}`);
      })
    );

    await expect(
      generatePoster({
        title: "真实跨域封面海报",
        description: "代理链失败时，带 CORS 的远程图片仍应能生成海报。",
        author: "作者",
        articleUrl: "https://iicats.com/posts/CX9R",
        coverImage: coverUrl,
      })
    ).resolves.toBe("data:image/png;base64,poster");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/proxy/download?url="), expect.any(Object));
    expect(fetch).toHaveBeenCalledWith(coverUrl, expect.objectContaining({ mode: "cors" }));
    expect(loadedImageSources).not.toContain(coverUrl);
    expect(loadedImageSources).toContain("blob:poster-cover");
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:poster-cover");
  });

  it("长站点副标题不会把底部二维码推出海报画布", async () => {
    await expect(
      generatePoster({
        title: "恢复解梦功能",
        description: "本文介绍了一个基于 AnHeYu 样式的解梦查询系统。",
        author: "懒和道人",
        siteName: "懒和道人",
        siteSubtitle: "李想和，智者未来。书法、国画爱好者，互联网安全与前端建设者。",
        articleUrl: "https://iicats.com/posts/dream",
      })
    ).resolves.toBe("data:image/png;base64,poster");

    const drawImage = vi.mocked(context.drawImage);
    const qrDraw = drawImage.mock.calls.find(call => call[3] === 120 && call[4] === 120);

    expect(qrDraw).toBeDefined();
    expect(Number(qrDraw?.[1]) + Number(qrDraw?.[3])).toBeLessThanOrEqual(710);
  });
});
