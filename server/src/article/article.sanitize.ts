import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize HTML content to strip XSS vectors.
 * Matches Go's SanitizeHTML behavior per D-70.
 * Returns null for null/undefined/empty input (matches Go nil behavior per RESEARCH Pitfall 3).
 */
export function sanitizeHtml(html: string | null | undefined): string | null {
  if (html == null || html === '') {
    return null;
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'blockquote', 'pre', 'code',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'a', 'img', 'figure', 'figcaption',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'iframe',
      'span', 'div',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel',
      'width', 'height', 'style', 'colspan', 'rowspan',
      'allowfullscreen', 'frameborder', 'loading',
    ],
  });
}
