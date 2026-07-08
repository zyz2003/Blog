import { marked } from 'marked';
import { sanitizeHtml } from '../article/article.sanitize';

/**
 * Configure marked for comment rendering.
 * Per D-122: uses marked with GFM + breaks for comment Markdown.
 * Per D-124: sanitizes HTML output with isomorphic-dompurify.
 */
marked.use({
  gfm: true,
  breaks: true,
  pedantic: false,
});

/**
 * Render comment Markdown content to sanitized HTML.
 * 1. Parse Markdown to HTML using marked (GFM + breaks)
 * 2. Sanitize HTML using isomorphic-dompurify (same as article sanitization)
 *
 * Per D-125: content stores Markdown原文, contentHtml stores rendered+sanitized HTML.
 */
export function renderCommentMarkdown(content: string): string {
  const html = marked.parse(content) as string;
  const sanitized = sanitizeHtml(html);
  return sanitized ?? '';
}
