import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from './html-to-text';

describe('htmlToPlainText', () => {
  it('strips HTML tags', () => {
    const result = htmlToPlainText('<p>Hello <strong>world</strong></p>');
    expect(result).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    const result = htmlToPlainText('A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39;');
    expect(result).toBe('A & B < C > D "E" \'F\'');
  });

  it('replaces &nbsp; with space', () => {
    const result = htmlToPlainText('Hello&nbsp;World');
    expect(result).toBe('Hello World');
  });

  it('removes code blocks', () => {
    const html = '<p>Text</p><pre><code>const x = 1;</code></pre><p>More</p>';
    const result = htmlToPlainText(html);
    expect(result).toBe('Text More');
    expect(result).not.toContain('const');
  });

  it('removes script tags', () => {
    const html = '<p>Text</p><script>alert("xss")</script><p>More</p>';
    const result = htmlToPlainText(html);
    expect(result).toBe('Text More');
    expect(result).not.toContain('alert');
  });

  it('removes style tags', () => {
    const html = '<p>Text</p><style>body { color: red; }</style><p>More</p>';
    const result = htmlToPlainText(html);
    expect(result).toBe('Text More');
    expect(result).not.toContain('color');
  });

  it('collapses multiple whitespace into single space', () => {
    const result = htmlToPlainText('<p>Hello</p>   <p>World</p>');
    expect(result).toBe('Hello World');
  });

  it('trims leading and trailing whitespace', () => {
    const result = htmlToPlainText('  <p>Hello</p>  ');
    expect(result).toBe('Hello');
  });

  it('handles complex HTML with nested tags', () => {
    const html = `
      <h1>Title</h1>
      <p>Paragraph with <a href="http://example.com">a link</a> and <em>emphasis</em>.</p>
      <ul><li>Item 1</li><li>Item 2</li></ul>
    `;
    const result = htmlToPlainText(html);
    expect(result).toContain('Title');
    expect(result).toContain('a link');
    expect(result).toContain('Item 1');
    expect(result).not.toContain('<');
  });
});
