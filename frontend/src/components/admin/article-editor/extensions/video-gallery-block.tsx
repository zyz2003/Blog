/**
 * VideoGalleryBlock 扩展
 * 视频画廊节点，支持多视频网格展示（含封面图）
 */
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useState, useRef } from "react";
import { ImageIcon, Pencil, Upload, Video } from "lucide-react";
import { postManagementApi } from "@/lib/api/post-management";
import { stripVideoFirstFrameFragment, withVideoFirstFrameFragment } from "@/lib/video-gallery";

// ---- 类型定义 ----
interface VideoGalleryItem {
  src: string;
  poster?: string;
  title?: string;
  desc?: string;
  type?: string;
}

const FALLBACK_VIDEO_TYPE = "video/mp4";
const MOBILE_VIDEO_PLAYBACK_PROPS = {
  "webkit-playsinline": "true",
  "x5-playsinline": "true",
  "x5-video-player-type": "h5",
} as const;
const VIDEO_TYPE_BY_EXTENSION: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
};

const getFileExtension = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const hasKnownVideoExtension = (file: File) =>
  Object.prototype.hasOwnProperty.call(VIDEO_TYPE_BY_EXTENSION, getFileExtension(file));
const isVideoFile = (file: File) => file.type.startsWith("video/") || hasKnownVideoExtension(file);
const getVideoType = (file: File) =>
  file.type.startsWith("video/") ? file.type : VIDEO_TYPE_BY_EXTENSION[getFileExtension(file)] || FALLBACK_VIDEO_TYPE;
const normalizeVideoGalleryRatio = (ratio: string) => {
  const trimmed = ratio.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)$/);
  if (!match) return trimmed;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return trimmed;
  }

  return `${Number(((height / width) * 100).toFixed(4))}%`;
};

// ---- React NodeView 组件 ----
function VideoGalleryBlockView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const [uploadingPosterIndex, setUploadingPosterIndex] = useState<number | null>(null);
  const [uploadingVideoIndex, setUploadingVideoIndex] = useState<number | null>(null);
  const posterFileInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<number>(0);

  const cols = parseInt((node.attrs.cols as string) || "2", 10);
  const gap = (node.attrs.gap as string) || "10px";
  const ratio = (node.attrs.ratio as string) || "";
  const normalizedRatio = normalizeVideoGalleryRatio(ratio);
  const itemsRaw = (node.attrs.items as string) || "[]";

  let items: VideoGalleryItem[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }
  const countClass = items.length > 0 ? ` video-gallery-count-${Math.min(items.length, 4)}` : "";

  const handleUploadPoster = async (file: File, index: number) => {
    setUploadingPosterIndex(index);
    try {
      const url = await postManagementApi.uploadArticleImage(file);
      const newItems = [...items];
      newItems[index] = { ...newItems[index], poster: url };
      updateAttributes({ items: JSON.stringify(newItems) });
    } catch (err) {
      console.error("上传封面失败", err);
    } finally {
      setUploadingPosterIndex(null);
    }
  };

  const handleUploadVideo = async (file: File, index: number) => {
    if (!isVideoFile(file)) {
      console.error("请选择视频文件");
      return;
    }

    setUploadingVideoIndex(index);
    try {
      const url = await postManagementApi.uploadArticleImage(file, { disableImageStyle: true });
      const newItems = [...items];
      const currentItem = newItems[index] ?? { src: "", poster: "", title: "", desc: "", type: FALLBACK_VIDEO_TYPE };
      newItems[index] = { ...currentItem, src: url, type: getVideoType(file) };
      updateAttributes({ items: JSON.stringify(newItems) });
    } catch (err) {
      console.error("上传视频失败", err);
    } finally {
      setUploadingVideoIndex(null);
    }
  };

  const uploadInputs = (
    <>
      <input
        ref={posterFileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleUploadPoster(file, uploadTarget);
          e.target.value = "";
        }}
      />
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*,.mp4,.m4v,.webm,.ogg,.ogv,.mov"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleUploadVideo(file, uploadTarget);
          e.target.value = "";
        }}
      />
    </>
  );

  // ---- 编辑模式 ----
  if (editing) {
    return (
      <NodeViewWrapper className="video-gallery-block-wrapper my-3">
        {uploadInputs}
        <div className="editor-btn-edit-panel" contentEditable={false}>
          <div className="editor-btn-header">
            <span className="editor-btn-title">编辑视频画廊</span>
            <button type="button" className="editor-btn-done" onClick={() => setEditing(false)}>
              完成
            </button>
          </div>

          <div className="editor-btn-form">
            <div className="editor-btn-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label className="editor-btn-field">
                <span className="editor-btn-label">列数</span>
                <select
                  value={cols}
                  onChange={e => updateAttributes({ cols: e.target.value })}
                  className="editor-btn-input"
                >
                  {[1, 2, 3, 4].map(n => (
                    <option key={n} value={n}>
                      {n} 列
                    </option>
                  ))}
                </select>
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">间距</span>
                <input
                  value={gap}
                  onChange={e => updateAttributes({ gap: e.target.value })}
                  className="editor-btn-input"
                  placeholder="10px"
                />
              </label>
              <label className="editor-btn-field">
                <span className="editor-btn-label">宽高比</span>
                <input
                  value={ratio}
                  onChange={e => updateAttributes({ ratio: e.target.value })}
                  className="editor-btn-input"
                  placeholder="16/9 或留空"
                />
              </label>
            </div>

            {/* 视频列表编辑 */}
            <div className="editor-btn-field">
              <span className="editor-btn-label">视频项（{items.length} 个）</span>
              <div className="editor-btngroup-items">
                {items.map((item, i) => (
                  <div key={i} className="editor-btngroup-item">
                    <div className="editor-btngroup-item-header">
                      <span className="editor-btngroup-item-index">{i + 1}</span>
                      <button
                        type="button"
                        className="editor-btngroup-item-remove"
                        onClick={() => {
                          const newItems = items.filter((_, idx) => idx !== i);
                          updateAttributes({ items: JSON.stringify(newItems) });
                        }}
                        title="删除此项"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="editor-btngroup-item-fields">
                      <div className="editor-video-upload-row">
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">视频 URL</span>
                          <input
                            value={item.src}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], src: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                            placeholder="视频 URL"
                          />
                        </label>
                        <button
                          type="button"
                          className="editor-video-upload-btn"
                          disabled={uploadingVideoIndex === i}
                          onClick={() => {
                            setUploadTarget(i);
                            videoFileInputRef.current?.click();
                          }}
                        >
                          <Video />
                          {uploadingVideoIndex === i ? "上传中..." : "上传视频"}
                        </button>
                      </div>
                      <div className="editor-btn-row">
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">封面图 URL</span>
                          <input
                            value={item.poster || ""}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], poster: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                            placeholder="封面图 URL"
                          />
                        </label>
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">标题</span>
                          <input
                            value={item.title || ""}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], title: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                            placeholder="标题"
                          />
                        </label>
                      </div>
                      <div className="editor-btn-row">
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">描述</span>
                          <input
                            value={item.desc || ""}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], desc: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                            placeholder="描述"
                          />
                        </label>
                        <label className="editor-btn-field">
                          <span className="editor-btn-label">格式</span>
                          <select
                            value={item.type || "video/mp4"}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[i] = { ...newItems[i], type: e.target.value };
                              updateAttributes({ items: JSON.stringify(newItems) });
                            }}
                            className="editor-btn-input"
                          >
                            <option value="video/mp4">MP4</option>
                            <option value="video/webm">WebM</option>
                            <option value="video/ogg">OGG</option>
                            <option value="video/quicktime">MOV</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="editor-btngroup-add"
                onClick={() => {
                  const newItems = [
                    ...items,
                    {
                      src: "",
                      poster: "",
                      title: "",
                      desc: "",
                      type: "video/mp4",
                    },
                  ];
                  updateAttributes({ items: JSON.stringify(newItems) });
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                添加视频
              </button>
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // ---- 预览模式 ----
  return (
    <NodeViewWrapper className="video-gallery-block-wrapper my-3">
      {uploadInputs}
      <div className="editor-node-hover-wrap" contentEditable={false}>
        <div
          className="editor-node-edit-btn"
          onClick={e => {
            e.stopPropagation();
            setEditing(true);
          }}
          contentEditable={false}
        >
          <Pencil /> 编辑
        </div>
        {items.length > 0 ? (
          <div
            className={`video-gallery-container video-gallery-cols-${cols}${countClass}`}
            style={{
              gap,
              ...(normalizedRatio ? ({ "--video-gallery-ratio": normalizedRatio } as React.CSSProperties) : {}),
            }}
          >
            {items.map((item, i) => {
              const playbackSrc = withVideoFirstFrameFragment(item.src, item.poster);

              return item.poster || item.src ? (
                <div key={i} className="video-gallery-item">
                  {item.src ? (
                    <div className="video-gallery-video-wrapper">
                      <video
                        className="video-gallery-video"
                        controls
                        preload="metadata"
                        playsInline
                        {...MOBILE_VIDEO_PLAYBACK_PROPS}
                        src={playbackSrc}
                        poster={item.poster || undefined}
                      >
                        <source src={playbackSrc} type={item.type || FALLBACK_VIDEO_TYPE} />
                      </video>
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.poster} alt={item.title || ""} className="video-gallery-poster" />
                      <div className="video-gallery-play-overlay">
                        <div className="video-gallery-play-btn">
                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </>
                  )}
                  {(item.title || item.desc) && (
                    <div className="video-gallery-caption">
                      {item.title && <div className="video-gallery-title">{item.title}</div>}
                      {item.desc && <div className="video-gallery-desc">{item.desc}</div>}
                    </div>
                  )}
                </div>
              ) : uploadingPosterIndex === i || uploadingVideoIndex === i ? (
                <div key={i} className="editor-gallery-uploading">
                  <div className="editor-gallery-spinner" />
                  <span>上传中...</span>
                </div>
              ) : (
                <div
                  key={i}
                  className="editor-gallery-empty-item"
                  onClick={() => {
                    setUploadTarget(i);
                    videoFileInputRef.current?.click();
                  }}
                  onDragOver={e => {
                    e.preventDefault();
                    e.currentTarget.classList.add("is-dragover");
                  }}
                  onDragLeave={e => e.currentTarget.classList.remove("is-dragover")}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("is-dragover");
                    const file = e.dataTransfer.files[0];
                    if (!file) return;
                    if (isVideoFile(file)) handleUploadVideo(file, i);
                    else if (file.type.startsWith("image/")) handleUploadPoster(file, i);
                  }}
                >
                  <Video />
                  <span className="editor-gallery-empty-text">上传视频或封面图</span>
                  <span className="editor-gallery-upload-actions">
                    <button
                      type="button"
                      className="editor-gallery-upload-btn"
                      onClick={e => {
                        e.stopPropagation();
                        setUploadTarget(i);
                        videoFileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-3 h-3" /> 上传视频
                    </button>
                    <button
                      type="button"
                      className="editor-gallery-upload-btn"
                      onClick={e => {
                        e.stopPropagation();
                        setUploadTarget(i);
                        posterFileInputRef.current?.click();
                      }}
                    >
                      <ImageIcon className="w-3 h-3" /> 上传封面
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem 0",
              border: "1px dashed var(--anzhiyu-card-border, #e3e8f7)",
              borderRadius: "12px",
              color: "var(--anzhiyu-secondtext, #999)",
              fontSize: "13px",
            }}
          >
            视频画廊（空）
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ---- 命令类型声明 ----
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    videoGalleryBlock: {
      /** 插入视频画廊 */
      insertVideoGallery: (attrs?: { cols?: number; gap?: string; ratio?: string; items?: string }) => ReturnType;
    };
  }
}

// ---- Tiptap 扩展 ----
export const VideoGalleryBlock = Node.create({
  name: "videoGalleryBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      cols: { default: "2" },
      gap: { default: "10px" },
      ratio: { default: "" },
      items: { default: "[]" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.video-gallery-container",
        getAttrs: (el: HTMLElement) => {
          const classList = el.className || "";
          const colsMatch = classList.match(/video-gallery-cols-(\d)/);
          const gapStyle = el.style.gap || "10px";
          const ratioStyle = el.style.getPropertyValue("--video-gallery-ratio") || "";

          const videoItems: VideoGalleryItem[] = [];
          el.querySelectorAll(".video-gallery-item").forEach(itemEl => {
            const video = itemEl.querySelector("video");
            const source = video?.querySelector("source");
            videoItems.push({
              src: stripVideoFirstFrameFragment(source?.getAttribute("src") || video?.getAttribute("src") || ""),
              poster: video?.getAttribute("poster") || "",
              title:
                itemEl.querySelector(".video-gallery-title")?.textContent ||
                itemEl.querySelector(".video-gallery-item-title")?.textContent ||
                "",
              desc:
                itemEl.querySelector(".video-gallery-desc")?.textContent ||
                itemEl.querySelector(".video-gallery-item-desc")?.textContent ||
                "",
              type: source?.getAttribute("type") || "video/mp4",
            });
          });

          return {
            cols: colsMatch ? colsMatch[1] : "2",
            gap: gapStyle,
            ratio: ratioStyle,
            items: JSON.stringify(videoItems),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const cols = (node.attrs.cols as string) || "2";
    const gap = (node.attrs.gap as string) || "10px";
    const ratio = (node.attrs.ratio as string) || "";
    const normalizedRatio = normalizeVideoGalleryRatio(ratio);

    let items: VideoGalleryItem[] = [];
    try {
      items = JSON.parse((node.attrs.items as string) || "[]");
    } catch {
      items = [];
    }

    const countClass = items.length > 0 ? ` video-gallery-count-${Math.min(items.length, 4)}` : "";
    const containerClass = `video-gallery-container video-gallery-cols-${cols}${countClass}`;
    const containerStyle = [`gap: ${gap}`, normalizedRatio ? `--video-gallery-ratio: ${normalizedRatio}` : ""]
      .filter(Boolean)
      .join("; ");

    const children = items.map(item => {
      const playbackSrc = withVideoFirstFrameFragment(item.src || "", item.poster);
      const videoAttrs: Record<string, string> = {
        class: "video-gallery-video",
        controls: "true",
        preload: "metadata",
        playsinline: "true",
        "webkit-playsinline": "true",
        "x5-playsinline": "true",
        "x5-video-player-type": "h5",
        src: playbackSrc,
      };
      if (item.poster) videoAttrs.poster = item.poster;

      const sourceAttrs: Record<string, string> = {
        src: playbackSrc,
        type: item.type || "video/mp4",
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const itemChildren: any[] = [
        ["div", { class: "video-gallery-video-wrapper" }, ["video", videoAttrs, ["source", sourceAttrs]]],
      ];
      const captionChildren: typeof itemChildren = [];

      if (item.title) {
        captionChildren.push(["div", { class: "video-gallery-title" }, item.title]);
      }
      if (item.desc) {
        captionChildren.push(["div", { class: "video-gallery-desc" }, item.desc]);
      }
      if (captionChildren.length > 0) {
        itemChildren.push(["div", { class: "video-gallery-caption" }, ...captionChildren]);
      }

      return ["div", { class: "video-gallery-item" }, ...itemChildren];
    });

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: containerClass,
        style: containerStyle,
      }),
      ...children,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoGalleryBlockView);
  },

  addCommands() {
    return {
      insertVideoGallery:
        (attrs = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              cols: String(attrs?.cols ?? 2),
              gap: attrs?.gap ?? "10px",
              ratio: attrs?.ratio ?? "",
              items:
                attrs?.items ??
                JSON.stringify([
                  {
                    src: "",
                    poster: "",
                    title: "",
                    desc: "",
                    type: "video/mp4",
                  },
                  {
                    src: "",
                    poster: "",
                    title: "",
                    desc: "",
                    type: "video/mp4",
                  },
                ]),
            },
          });
        },
    };
  },
});
