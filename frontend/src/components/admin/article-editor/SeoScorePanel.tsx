"use client";

import { useMemo, useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";

interface SeoScorePanelProps {
  title: string;
  slug: string;
  description: string;
  editor: Editor | null;
}

interface SeoCheckResult {
  key: string;
  label: string;
  status: "good" | "warning" | "error";
  message: string;
}

/**
 * 对文章内容进行 SEO 评分
 * 纯前端计算，不依赖后端 API
 */
function analyzeSeo(
  title: string,
  slug: string,
  description: string,
  editor: Editor | null
): { score: number; checks: SeoCheckResult[] } {
  const checks: SeoCheckResult[] = [];
  const plainText = editor?.state.doc.textContent ?? "";

  // 1. 标题长度
  const titleLen = title.length;
  if (titleLen === 0) {
    checks.push({ key: "title_empty", label: "文章标题", status: "error", message: "标题不能为空" });
  } else if (titleLen < 10) {
    checks.push({ key: "title_short", label: "标题长度", status: "warning", message: `标题过短（${titleLen} 字），建议 15-65 字` });
  } else if (titleLen > 65) {
    checks.push({ key: "title_long", label: "标题长度", status: "warning", message: `标题过长（${titleLen} 字），搜索引擎可能截断` });
  } else {
    checks.push({ key: "title_ok", label: "标题长度", status: "good", message: `标题长度适中（${titleLen} 字）` });
  }

  // 2. Meta Description
  const descLen = description.length;
  if (descLen === 0) {
    checks.push({ key: "desc_empty", label: "文章描述", status: "warning", message: "建议填写文章描述/摘要" });
  } else if (descLen < 50) {
    checks.push({ key: "desc_short", label: "描述长度", status: "warning", message: `描述过短（${descLen} 字），建议 50-160 字` });
  } else if (descLen > 160) {
    checks.push({ key: "desc_long", label: "描述长度", status: "warning", message: `描述过长（${descLen} 字），搜索引擎可能截断` });
  } else {
    checks.push({ key: "desc_ok", label: "描述长度", status: "good", message: `描述长度适中（${descLen} 字）` });
  }

  // 3. URL Slug
  if (!slug) {
    checks.push({ key: "slug_empty", label: "URL 别名", status: "warning", message: "建议设置自定义 URL 别名" });
  } else if (slug.length > 60) {
    checks.push({ key: "slug_long", label: "URL 别名", status: "warning", message: "URL 过长，建议精简" });
  } else {
    checks.push({ key: "slug_ok", label: "URL 别名", status: "good", message: "URL 别名已设置" });
  }

  // 4. 正文长度
  const wordCount = countWords(plainText);
  if (wordCount < 100) {
    checks.push({ key: "content_short", label: "正文长度", status: "error", message: `内容过短（${wordCount} 字），建议至少 300 字` });
  } else if (wordCount < 300) {
    checks.push({ key: "content_medium", label: "正文长度", status: "warning", message: `内容偏短（${wordCount} 字），建议增加到 300 字以上` });
  } else {
    checks.push({ key: "content_ok", label: "正文长度", status: "good", message: `正文长度充足（${wordCount} 字）` });
  }

  // 5-7: 使用 ProseMirror doc tree 遍历（比正则解析更准确）
  let headingCount = 0;
  let imgTotal = 0;
  let imgNoAlt = 0;
  let allLinks = 0;

  if (editor) {
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading") {
        const level = node.attrs.level as number;
        if (level >= 2 && level <= 4) headingCount++;
      }
      if (node.type.name === "image") {
        imgTotal++;
        const alt = (node.attrs.alt as string) || "";
        if (!alt.trim()) imgNoAlt++;
      }
      if (node.marks) {
        for (const mark of node.marks) {
          if (mark.type.name === "link" && mark.attrs.href) allLinks++;
        }
      }
    });
  }

  // 5. 标题层级
  if (wordCount > 300 && headingCount === 0) {
    checks.push({ key: "heading_none", label: "子标题", status: "warning", message: "长文建议使用 H2-H4 子标题划分段落" });
  } else if (headingCount > 0) {
    checks.push({ key: "heading_ok", label: "子标题", status: "good", message: `使用了 ${headingCount} 个子标题` });
  }

  // 6. 图片 Alt 标签
  if (imgTotal === 0) {
    checks.push({ key: "img_none", label: "图片", status: "warning", message: "文章没有图片，适当配图有助于 SEO" });
  } else if (imgNoAlt > 0) {
    checks.push({ key: "img_alt", label: "图片 Alt", status: "warning", message: `${imgNoAlt} 张图片缺少 Alt 描述` });
  } else {
    checks.push({ key: "img_ok", label: "图片 Alt", status: "good", message: `所有 ${imgTotal} 张图片都有 Alt 描述` });
  }
  if (allLinks === 0 && wordCount > 300) {
    checks.push({ key: "link_none", label: "链接", status: "warning", message: "长文建议添加内链或外链" });
  } else if (allLinks > 0) {
    checks.push({ key: "link_ok", label: "链接", status: "good", message: `包含 ${allLinks} 个链接` });
  }

  // 8. 首段含关键词
  const firstParagraph = plainText.slice(0, 150);
  const titleWords = title
    .replace(/[^\u4e00-\u9fff\w]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const keywordInFirst = titleWords.some((w) =>
    firstParagraph.toLowerCase().includes(w.toLowerCase())
  );
  if (title && wordCount > 100) {
    if (keywordInFirst) {
      checks.push({ key: "keyword_first", label: "首段关键词", status: "good", message: "首段包含标题关键词" });
    } else {
      checks.push({ key: "keyword_first_miss", label: "首段关键词", status: "warning", message: "首段未包含标题关键词" });
    }
  }

  // 计算总分
  const totalChecks = checks.length;
  const goodCount = checks.filter((c) => c.status === "good").length;
  const warningCount = checks.filter((c) => c.status === "warning").length;
  const score = totalChecks > 0 ? Math.round(((goodCount * 1 + warningCount * 0.5) / totalChecks) * 100) : 0;

  return { score, checks };
}

/**
 * 统计中文字符 + 英文单词数
 */
function countWords(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const english = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "").match(/[a-zA-Z0-9]+/g) || []).length;
  return chinese + english;
}

/**
 * SEO 评分面板
 * 在文章编辑侧栏中显示实时 SEO 评分和优化建议
 */
export function SeoScorePanel({ title, slug, description, editor }: SeoScorePanelProps) {
  // 订阅 editor 内容变化以触发重新评分
  const [editorVersion, setEditorVersion] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setEditorVersion((v) => v + 1);
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor]);

  const { score, checks } = useMemo(
    () => analyzeSeo(title, slug, description, editor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, slug, description, editorVersion]
  );

  const scoreColor =
    score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const scoreBg =
    score >= 80 ? "bg-green-500/10" : score >= 50 ? "bg-yellow-500/10" : "bg-red-500/10";

  return (
    <div className="space-y-4">
      {/* 分数展示 */}
      <div className={cn("flex items-center gap-3 p-3 rounded-lg", scoreBg)}>
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-muted/20"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${score}, 100`}
              className={scoreColor}
            />
          </svg>
          <span className={cn("absolute inset-0 flex items-center justify-center text-sm font-bold", scoreColor)}>
            {score}
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            SEO 评分
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {score >= 80 ? "表现优秀" : score >= 50 ? "有待改善" : "需要优化"}
          </div>
        </div>
      </div>

      {/* 检查项列表 */}
      <div className="space-y-1">
        {checks.map((check) => (
          <div
            key={check.key}
            className="flex items-start gap-2 px-2 py-1.5 rounded-md text-xs"
          >
            <span className="mt-0.5 shrink-0">
              {check.status === "good" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {check.status === "warning" && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
              {check.status === "error" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
            </span>
            <div>
              <span className="font-medium text-foreground">{check.label}</span>
              <span className="text-muted-foreground ml-1">- {check.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
