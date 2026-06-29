"use client";

import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, addToast } from "@heroui/react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileText,
  Info,
  Package,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { useImportArticles } from "@/hooks/queries/use-post-management";

interface ImportModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: ReturnType<typeof useImportArticles>;
}

const migrationSteps = [
  {
    title: "整理来源内容",
    description: "从 Hexo、Jekyll、WordPress 等平台导出 Markdown/HTML，保留 front matter、图片链接和 slug。",
  },
  {
    title: "转换为导入 JSON",
    description: "把 front matter 映射到文章字段，正文写入 content_md，并生成可预览的 content_html。",
  },
  {
    title: "上传 JSON 或 ZIP",
    description: "直接上传 articles.json，或把它放在 ZIP 根目录后上传，markdown/ 目录仅作为备份。",
  },
];

const hexoFieldMappings = [
  ["title", "title", "文章标题，建议必填。"],
  ["date", "created_at", "支持 RFC3339 时间，导入后作为发布时间。"],
  ["updated", "updated_at", "没有 updated 时可沿用 date。"],
  ["categories", "categories", "数组或单个分类名，默认会自动创建不存在的分类。"],
  ["tags", "tags", "数组或单个标签名，默认会自动创建不存在的标签。"],
  ["cover / top_img", "cover_url / top_img_url", "建议使用可公网访问的完整 URL。"],
  ["abbrlink / slug", "abbrlink", "用于稳定链接，也会用于跳过重复文章。"],
  ["keywords", "keywords", "多个关键词可用英文逗号分隔。"],
  ["Markdown 正文", "content_md", "去掉 front matter 后的 Markdown 正文。"],
  ["渲染后的 HTML", "content_html", "可由 Markdown 渲染器生成，用于导入后直接预览。"],
];

const migrationTips = [
  "当前导入器读取 JSON 数据；ZIP 内的 markdown/ 目录用于人工核对，不会单独解析 Hexo Markdown 文件。",
  "图片建议先替换为可访问 URL；若仍是本地相对路径，导入后需要在文章编辑器里重新上传或替换。",
  "为每篇文章保留稳定的 abbrlink，可降低重复导入时误判的概率。",
  "从非 AnHeYu 平台迁移时，建议先导入为 DRAFT 草稿，检查正文、图片、分类和标签后再发布。",
];

export function ImportModal({ isOpen, onOpenChange, onImport }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFormatHelpOpen, setIsFormatHelpOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSupportedFile = (nextFile: File) => {
    const lowerCaseName = nextFile.name.toLowerCase();
    return lowerCaseName.endsWith(".json") || lowerCaseName.endsWith(".zip");
  };

  const selectFile = (nextFile: File | null) => {
    if (!nextFile) return;

    if (!isSupportedFile(nextFile)) {
      addToast({ title: "仅支持 JSON 或 ZIP 文件", color: "warning", timeout: 3000 });
      return;
    }

    setFile(nextFile);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0] ?? null);
  };

  const handleDragEnter = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleImport = async () => {
    if (!file) {
      addToast({ title: "请选择文件", color: "warning", timeout: 3000 });
      return;
    }
    try {
      const result = await onImport.mutateAsync({ file });
      const msg =
        result.failed_count > 0
          ? `导入完成：成功 ${result.success_count} 篇，跳过 ${result.skipped_count} 篇，失败 ${result.failed_count} 篇`
          : `导入完成：成功 ${result.success_count} 篇，跳过 ${result.skipped_count} 篇`;
      addToast({
        title: msg,
        color: result.failed_count > 0 ? "warning" : "success",
        timeout: 5000,
      });
      setFile(null);
      onOpenChange(false);
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "导入失败", color: "danger", timeout: 3000 });
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" placement="center" size="2xl" scrollBehavior="inside">
      <ModalContent>
        {onClose => (
          <>
            <ModalHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-50">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span>导入文章</span>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">支持 JSON 或 ZIP 格式</p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="rounded-xl border border-primary/15 bg-primary-50/30 dark:bg-primary-900/10">
                <button
                  type="button"
                  onClick={() => setIsFormatHelpOpen(open => !open)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                    <Info className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block">查看导入格式与迁移指南</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        适用于 AnHeYu、Hexo、Jekyll、WordPress 等来源
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isFormatHelpOpen ? "rotate-180" : ""
                    )}
                  />
                </button>
                {isFormatHelpOpen && (
                  <div className="space-y-5 border-t border-primary/10 px-4 pb-4 pt-4 text-xs leading-5 text-muted-foreground">
                    <div className="flex gap-3 rounded-lg border border-primary/10 bg-background/70 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">推荐先转换，再导入</p>
                        <p>
                          目前导入器直接读取 <span className="font-medium text-foreground">articles.json</span>。Hexo
                          这类 Markdown/front matter 平台请先把元数据映射成 JSON 字段，再上传 JSON 或包含 JSON 的 ZIP。
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        推荐迁移流程
                      </div>
                      <div className="grid gap-2 md:grid-cols-3">
                        {migrationSteps.map((step, index) => (
                          <div key={step.title} className="rounded-lg border border-border/60 bg-background/60 p-3">
                            <div className="mb-2 flex items-center gap-2 text-foreground">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                                {index + 1}
                              </span>
                              <span className="font-medium">{step.title}</span>
                            </div>
                            <p>{step.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div>
                        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                          <Package className="h-4 w-4 text-primary" />
                          ZIP 文件结构
                        </div>
                        <pre className="overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-5 text-foreground">
{`anheyu-import.zip
├─ articles.json
└─ markdown/
   └─ hello-hexo.md`}
                        </pre>
                        <p className="mt-2">
                          ZIP 根目录必须包含 articles.json。普通 JSON 可直接上传，无需打包。
                        </p>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                          <ArrowRight className="h-4 w-4 text-primary" />
                          导入策略
                        </div>
                        <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
                          <p>默认自动创建不存在的分类和标签。</p>
                          <p>默认按 abbrlink 优先，其次按标题跳过已存在文章。</p>
                          <p>未提供 status 时按 DRAFT 草稿导入；可使用 PUBLISHED、ARCHIVED 或 SCHEDULED。</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                        <Table2 className="h-4 w-4 text-primary" />
                        Hexo Front Matter 字段映射
                      </div>
                      <div className="overflow-hidden rounded-lg border border-border/60">
                        <div className="hidden grid-cols-[1fr_1fr_1.4fr] gap-2 bg-muted/70 px-3 py-2 text-[11px] font-medium text-foreground sm:grid">
                          <span>Hexo 字段</span>
                          <span>AnHeYu JSON</span>
                          <span>说明</span>
                        </div>
                        {hexoFieldMappings.map(([source, target, description]) => (
                          <div
                            key={`${source}-${target}`}
                            className="grid gap-1 border-t border-border/60 px-3 py-2 sm:grid-cols-[1fr_1fr_1.4fr] sm:gap-2"
                          >
                            <code className="break-words rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-foreground">
                              {source}
                            </code>
                            <code className="break-words rounded bg-primary-50 px-1.5 py-0.5 text-[11px] text-primary">
                              {target}
                            </code>
                            <span>{description}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                        <Code2 className="h-4 w-4 text-primary" />
                        Hexo 迁移 JSON 示例
                      </div>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-muted/60 p-3 text-[11px] leading-5 text-foreground">
{`{
  "version": "1.0",
  "export_at": "2026-06-10T12:00:00+08:00",
  "articles": [
    {
      "title": "Hello Hexo",
      "content_md": "这里是去掉 front matter 后的 Markdown 正文...",
      "content_html": "<p>这里是渲染后的 HTML 正文...</p>",
      "status": "DRAFT",
      "created_at": "2025-06-01T10:30:00+08:00",
      "updated_at": "2025-06-02T11:00:00+08:00",
      "categories": ["随笔"],
      "tags": ["Hexo", "迁移"],
      "cover_url": "https://example.com/cover.jpg",
      "top_img_url": "https://example.com/top.jpg",
      "abbrlink": "hello-hexo",
      "summaries": ["从 Hexo 迁移过来的第一篇文章"],
      "keywords": "Hexo,迁移"
    }
  ],
  "meta": {
    "source": "hexo",
    "note": "markdown/ 目录仅作备份，导入以 JSON 为准"
  }
}`}
                      </pre>
                    </div>

                    <div>
                      <p className="mb-2 font-medium text-foreground">迁移注意事项</p>
                      <ul className="space-y-1.5">
                        {migrationTips.map(tip => (
                          <li key={tip} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3">
                        可选字段还包括 summaries、home_sort、pin_sort、copyright、is_reprint、copyright_author、
                        copyright_author_href、copyright_url、primary_color、is_primary_color_manual。
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "w-full border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary-50/40 ring-2 ring-primary/25"
                    : "",
                  file
                    ? "border-primary/50 bg-primary-50/30"
                    : "border-border/60 hover:border-primary/30 hover:bg-muted/30"
                )}
              >
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2.5 rounded-xl bg-primary-100">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="p-2.5 rounded-xl bg-muted">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-medium">{isDragging ? "释放鼠标上传文件" : "拖拽文件到此处，或点击选择文件"}</span>
                    <span className="text-xs text-muted-foreground/40">JSON / ZIP</span>
                  </div>
                )}
              </button>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose} isDisabled={onImport.isPending}>
                取消
              </Button>
              <Button color="primary" onPress={handleImport} isDisabled={!file} isLoading={onImport.isPending}>
                开始导入
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
