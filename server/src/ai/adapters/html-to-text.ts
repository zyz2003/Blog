/**
 * htmlToPlainText — pure function to strip HTML and produce readable plain text.
 * Extracted from the original ai.service.ts for reuse without NestJS/AI SDK coupling.
 *
 * Steps:
 * 1. Remove <pre><code> code blocks
 * 2. Remove <style> and <script> blocks
 * 3. Remove all remaining HTML tags
 * 4. Decode common HTML entities
 * 5. Collapse whitespace
 */
export function htmlToPlainText(html: string): string {
  let text = html;

  // Remove code blocks
  text = text.replace(/<pre[\s\S]*?<\/pre>/gi, ' ');
  text = text.replace(/<code[\s\S]*?<\/code>/gi, ' ');

  // Remove style and script
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
