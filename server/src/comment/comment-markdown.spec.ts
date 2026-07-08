import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderCommentMarkdown } from './comment-markdown';

describe('renderCommentMarkdown', () => {
  it('should render basic Markdown to HTML', () => {
    const result = renderCommentMarkdown('Hello **world**');
    expect(result).toContain('<strong>world</strong>');
  });

  it('should render GFM line breaks (breaks: true)', () => {
    const result = renderCommentMarkdown('Line 1\nLine 2');
    expect(result).toContain('<br>');
  });

  it('should render GFM features like strikethrough', () => {
    const result = renderCommentMarkdown('~~deleted~~');
    expect(result).toContain('<del>deleted</del>');
  });

  it('should sanitize XSS vectors from HTML output', () => {
    const result = renderCommentMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  });

  it('should sanitize onclick attributes', () => {
    const result = renderCommentMarkdown('[click](javascript:alert(1))');
    expect(result).not.toContain('javascript:');
  });

  it('should render links with allowed attributes', () => {
    const result = renderCommentMarkdown('[test](https://example.com)');
    expect(result).toContain('href');
    expect(result).toContain('https://example.com');
  });

  it('should render inline code', () => {
    const result = renderCommentMarkdown('Use `console.log` here');
    expect(result).toContain('<code>console.log</code>');
  });

  it('should render code blocks', () => {
    const result = renderCommentMarkdown('```\nconst x = 1;\n```');
    expect(result).toContain('<code>');
  });

  it('should handle empty content', () => {
    const result = renderCommentMarkdown('');
    // marked returns empty string for empty input, sanitizeHtml returns null for empty
    expect(result).toBe('');
  });

  it('should render blockquotes', () => {
    const result = renderCommentMarkdown('> This is a quote');
    expect(result).toContain('<blockquote>');
  });

  it('should render unordered lists', () => {
    const result = renderCommentMarkdown('- item 1\n- item 2');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>');
  });
});
