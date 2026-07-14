import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ArticleService } from '../article/article.service';
import { SettingsService } from '../settings/settings.service';
import { MemoryCache } from '../common/cache/memory-cache.util';
import { generatePublicID, EntityType } from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';

// ─── RSS Types ──────────────────────────────────────────────────────

export interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  author: string;
  categories: string[];
}

export interface RSSFeed {
  title: string;
  link: string;
  description: string;
  language: string;
  pubDate: string;
  lastBuildDate: string;
  items: RSSItem[];
}

export interface RSSOptions {
  itemCount: number;
  baseURL: string;
  buildTime: Date;
}

// ─── RssService ─────────────────────────────────────────────────────

@Injectable()
export class RssService {
  private readonly logger = new Logger(RssService.name);

  constructor(
    @Inject(forwardRef(() => ArticleService))
    private readonly articleService: ArticleService,
    private readonly settingsService: SettingsService,
    private readonly cache: MemoryCache,
  ) {}

  /**
   * Generate RSS feed with caching.
   * Per D-213: MemoryCache key `rss:feed:latest`, TTL 1 hour.
   * Matches Go GenerateFeed (pkg/service/rss/service.go).
   */
  async generateFeed(options: RSSOptions): Promise<RSSFeed> {
    const cacheKey = 'rss:feed:latest';
    const cached = this.cache.get<RSSFeed>(cacheKey);
    if (cached) {
      return cached;
    }

    // Read site config from settings
    const siteTitle = this.settingsService.get('APP_NAME') || 'Anheyu Blog';
    const siteDescription = this.settingsService.get('SITE_DESCRIPTION') || '';

    // Fetch latest public articles
    const result = await this.articleService.listPublic({
      page: 1,
      pageSize: options.itemCount,
    });

    // Build date strings in RFC 1123 format (Go's time.RFC1123Z)
    const pubDate = this.formatRFC1123Z(options.buildTime);
    const lastBuildDate = pubDate;

    // Build items
    const items: RSSItem[] = result.list.map((article: any) =>
      this.buildRSSItem(article, options.baseURL),
    );

    const feed: RSSFeed = {
      title: siteTitle,
      link: options.baseURL,
      description: siteDescription,
      language: 'zh-CN',
      pubDate,
      lastBuildDate,
      items,
    };

    // Cache for 1 hour (3600000ms)
    this.cache.set(cacheKey, feed, 3600000);

    return feed;
  }

  /**
   * Build a single RSS item from an article.
   * Matches Go buildRSSItem (pkg/service/rss/service.go).
   */
  buildRSSItem(article: any, baseURL: string): RSSItem {
    // Link: use abbrlink if available, else Sqids-encoded publicId
    const articleId = article.abbrlink || article.id;
    const link = `${baseURL}/posts/${articleId}`;

    // pubDate: RFC 1123 format of article.createdAt
    const pubDate = this.formatRFC1123Z(new Date(article.created_at));

    // Description: priority summaries[0] > stripped HTML > raw MD > empty
    const description = this.getArticleDescription(article);

    // Author: copyrightAuthor or empty string
    const author = article.copyright_author || '';

    // Categories: from postCategories (name) + postTags (name), flattened
    const categories: string[] = [
      ...(article.post_categories || []).map((c: any) => c.name),
      ...(article.post_tags || []).map((t: any) => t.name),
    ];

    return {
      title: article.title || '',
      link,
      description,
      pubDate,
      guid: link,
      author,
      categories,
    };
  }

  /**
   * Get article description with priority fallback.
   * Matches Go getArticleDescription (pkg/service/rss/service.go).
   *
   * Priority:
   * 1. summaries[0] if non-empty string
   * 2. Strip HTML from contentHtml, truncate to 200 chars (UTF-8 rune-aware)
   * 3. Truncate contentMd to 200 chars
   * 4. Empty string
   */
  getArticleDescription(article: any): string {
    // Priority 1: summaries[0]
    if (article.summaries && Array.isArray(article.summaries) && article.summaries.length > 0) {
      const first = article.summaries[0];
      if (typeof first === 'string' && first.trim()) {
        return first.trim();
      }
    }

    // Priority 2: Strip HTML from contentHtml, truncate to 200 chars
    if (article.content_html) {
      const stripped = this.stripHtml(article.content_html);
      if (stripped) {
        return this.truncateUTF8(stripped, 200);
      }
    }

    // Priority 3: Truncate contentMd to 200 chars
    if (article.content_md) {
      return this.truncateUTF8(article.content_md, 200);
    }

    // Priority 4: empty string
    return '';
  }

  /**
   * Generate RSS 2.0 XML string from feed data.
   * Matches Go GenerateXML (pkg/service/rss/service.go) — manual string building.
   */
  generateXML(feed: RSSFeed): string {
    const parts: string[] = [];

    parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">');
    parts.push('  <channel>');
    parts.push(`    <title>${this.xmlEscape(feed.title)}</title>`);
    parts.push(`    <link>${this.xmlEscape(feed.link)}</link>`);
    parts.push(`    <description>${this.xmlEscape(feed.description)}</description>`);
    parts.push(`    <language>${feed.language}</language>`);
    parts.push(`    <lastBuildDate>${feed.lastBuildDate}</lastBuildDate>`);
    parts.push(`    <atom:link href="${this.xmlEscape(feed.link)}/rss.xml" rel="self" type="application/rss+xml"/>`);

    for (const item of feed.items) {
      parts.push('    <item>');
      parts.push(`      <title>${this.xmlEscape(item.title)}</title>`);
      parts.push(`      <link>${this.xmlEscape(item.link)}</link>`);
      parts.push(`      <guid isPermaLink="true">${this.xmlEscape(item.guid)}</guid>`);
      parts.push(`      <pubDate>${item.pubDate}</pubDate>`);
      if (item.description) {
        parts.push(`      <description>${this.xmlEscape(item.description)}</description>`);
      }
      if (item.author) {
        parts.push(`      <author>${this.xmlEscape(item.author)}</author>`);
      }
      for (const category of item.categories) {
        parts.push(`      <category>${this.xmlEscape(category)}</category>`);
      }
      parts.push('    </item>');
    }

    parts.push('  </channel>');
    parts.push('</rss>');

    return parts.join('\n');
  }

  /**
   * Escape XML entities.
   * Matches Go xmlEscape — 5 replacements in order (& MUST be first).
   */
  xmlEscape(s: string): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;')   // MUST be first to avoid double-escaping
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Invalidate RSS feed cache.
   * Per D-215: Called from ArticleService create/update/delete.
   */
  invalidateCache(): void {
    this.cache.delete('rss:feed:latest');
  }

  /**
   * Get base URL from settings or request.
   * Matches Go GetRSSFeed site URL resolution.
   */
  getBaseURL(req: any): string {
    let baseURL = this.settingsService.get('SITE_URL') || '';

    if (!baseURL && req) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.get('host') || req.headers.host || 'localhost:8091';
      baseURL = `${protocol}://${host}`;
    }

    // Strip trailing slash
    return baseURL.replace(/\/+$/, '');
  }

  // ─── Private helpers ──────────────────────────────────────────────

  /**
   * Format date as RFC 1123 with numeric timezone offset.
   * Matches Go time.RFC1123Z format: "Mon, 02 Jan 2006 15:04:05 -0700"
   * JavaScript's toUTCString() produces "Mon, 02 Jan 2006 15:04:05 GMT"
   * We replace "GMT" with "+0000" to match Go's format.
   */
  private formatRFC1123Z(date: Date): string {
    return date.toUTCString().replace('GMT', '+0000');
  }

  /**
   * Strip HTML tags from text.
   * Simple regex-based stripping sufficient for RSS descriptions.
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }

  /**
   * Truncate string to maxLen characters (UTF-8 rune-aware).
   * Uses Array.from() to count code points, not bytes.
   */
  private truncateUTF8(text: string, maxLen: number): string {
    const chars = Array.from(text);
    if (chars.length <= maxLen) return text;
    return chars.slice(0, maxLen).join('');
  }
}
