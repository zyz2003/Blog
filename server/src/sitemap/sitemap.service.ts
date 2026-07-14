import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { ArticleService } from '../article/article.service';
import { PageService } from '../page/page.service';
import { SettingsService } from '../settings/settings.service';
import { XMLBuilder } from 'fast-xml-parser';

// ─── Sitemap Types ──────────────────────────────────────────────────

type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

interface SitemapItem {
  url: string;
  lastModified: Date | null;
  changeFreq: ChangeFrequency;
  priority: number;
}

interface URLSet {
  urls: Array<{
    loc: string;
    lastmod: string;
    changefreq: ChangeFrequency;
    priority: string;
  }>;
}

// ─── SitemapService ─────────────────────────────────────────────────

@Injectable()
export class SitemapService {
  private readonly logger = new Logger(SitemapService.name);

  /** XML builder configured to match Go's xml.MarshalIndent output */
  private readonly xmlBuilder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    attributeNamePrefix: '@_',
  });

  constructor(
    @Inject(forwardRef(() => ArticleService))
    private readonly articleService: ArticleService,
    private readonly pageService: PageService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Generate sitemap URLSet with all URL entries.
   * Per D-214: NO caching — regenerated on every request.
   * Matches Go GenerateSitemap (pkg/service/sitemap/service.go).
   */
  async generateSitemap(): Promise<URLSet> {
    const baseURL = this.getBaseURL();
    const items: SitemapItem[] = [];

    // 1. Homepage
    items.push({
      url: `${baseURL}/`,
      lastModified: new Date(),
      changeFreq: 'daily',
      priority: 1.0,
    });

    // 2. Public articles
    await this.addArticles(items, baseURL);

    // 3. Published pages
    await this.addPages(items, baseURL);

    // 4. Link page (static URL entry, no LinkService data needed)
    // CR-02 fix: Go backend sets LastModified: time.Now() for all static pages
    items.push({
      url: `${baseURL}/link`,
      lastModified: new Date(),
      changeFreq: 'weekly',
      priority: 0.6,
    });

    // 5. Common pages
    items.push({
      url: `${baseURL}/archives`,
      lastModified: new Date(),
      changeFreq: 'daily',
      priority: 0.7,
    });
    items.push({
      url: `${baseURL}/categories`,
      lastModified: new Date(),
      changeFreq: 'weekly',
      priority: 0.6,
    });
    items.push({
      url: `${baseURL}/tags`,
      lastModified: new Date(),
      changeFreq: 'weekly',
      priority: 0.6,
    });
    items.push({
      url: `${baseURL}/about`,
      lastModified: new Date(),
      changeFreq: 'monthly',
      priority: 0.5,
    });

    // Convert SitemapItem[] to URLSet
    return {
      urls: items.map((item) => ({
        loc: item.url,
        // WR-02 fix: Match Go backend date format (no milliseconds, timezone offset)
        lastmod: item.lastModified ? this.formatLastmod(item.lastModified) : '',
        changefreq: item.changeFreq,
        // WR-03 fix: Match Go float32 formatting (drop trailing zeros)
        priority: this.formatPriority(item.priority),
      })),
    };
  }

  /**
   * Generate XML string from URLSet using fast-xml-parser.
   * Per D-216: Use XML library serialization (matching Go's xml.MarshalIndent).
   */
  generateXML(urlSet: URLSet): string {
    const xmlObj = {
      '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
      urlset: {
        '@_xmlns': 'http://www.sitemaps.org/schemas/sitemap/0.9',
        url: urlSet.urls.map((u) => {
          const entry: Record<string, string> = {
            loc: u.loc,
            changefreq: u.changefreq,
            priority: u.priority,
          };
          // Only include lastmod if non-empty
          if (u.lastmod) {
            entry.lastmod = u.lastmod;
          }
          return entry;
        }),
      },
    };

    return this.xmlBuilder.build(xmlObj);
  }

  /**
   * Generate robots.txt content.
   * Matches Go GenerateRobots (pkg/service/sitemap/service.go).
   * CR-01 fix: Include Chinese comments, blank line separators, and trailing newline matching Go backend.
   * WR-01 fix: No xmlEscape — robots.txt is plain text, not XML.
   */
  generateRobots(): string {
    const baseURL = this.getBaseURL();
    return [
      'User-agent: *',
      'Allow: /',
      '',
      '# 禁止访问管理后台',
      'Disallow: /admin/',
      '',
      '# 站点地图',
      `Sitemap: ${baseURL}/sitemap.xml`,
      '',
    ].join('\n');
  }

  /**
   * Get base URL from settings.
   * Matches Go getBaseURL — reads SITE_URL, fallback to defaultBaseURL.
   */
  getBaseURL(): string {
    const baseURL =
      this.settingsService.get('SITE_URL') || 'https://blog.anheyu.com';
    // Strip trailing slash
    return baseURL.replace(/\/+$/, '');
  }

  // ─── Private helpers ──────────────────────────────────────────────

  /**
   * Add public articles to sitemap items.
   * Per Go addArticles: URL uses abbrlink if non-empty, else Sqids-encoded publicId.
   * Priority/frequency based on update time.
   */
  private async addArticles(items: SitemapItem[], baseURL: string): Promise<void> {
    try {
      const result = await this.articleService.listPublic({
        page: 1,
        pageSize: 10000, // CR-03 fix: Match Go backend's 10000 page size
      });

      for (const article of result.list) {
        // URL: use abbrlink if available, else Sqids-encoded publicId
        const articleId = article.abbrlink || article.id;
        const url = `${baseURL}/posts/${articleId}`;

        // Calculate hours since last update
        const updatedAt = article.updated_at
          ? new Date(article.updated_at)
          : new Date();
        const hoursDiff = this.getTimeDiffHours(updatedAt);

        // Priority/frequency based on update time (matching Go backend)
        let priority: number;
        let changeFreq: ChangeFrequency;

        if (hoursDiff < 24) {
          priority = 0.9;
          changeFreq = 'daily';
        } else if (hoursDiff < 168) {
          // 7 days
          priority = 0.8;
          changeFreq = 'weekly';
        } else if (hoursDiff < 720) {
          // 30 days
          priority = 0.7;
          changeFreq = 'monthly';
        } else {
          priority = 0.6;
          changeFreq = 'yearly';
        }

        items.push({
          url,
          lastModified: updatedAt,
          changeFreq,
          priority,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to fetch articles for sitemap, skipping');
    }
  }

  /**
   * Add published pages to sitemap items.
   * Per Go addPages: strip leading / from pagePath to avoid double slashes.
   */
  private async addPages(items: SitemapItem[], baseURL: string): Promise<void> {
    try {
      const result = await this.pageService.list({
        page: 1,
        pageSize: 1000,
        isPublished: true,
      });

      for (const page of result.pages) {
        // Strip leading / from path to avoid double slashes
        const pagePath = (page.path || '').replace(/^\/+/, '');
        if (!pagePath) continue; // Skip pages with empty path

        const url = `${baseURL}/${pagePath}`;
        const updatedAt = page.updated_at
          ? new Date(page.updated_at)
          : null;

        items.push({
          url,
          lastModified: updatedAt,
          changeFreq: 'monthly',
          priority: 0.5,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to fetch pages for sitemap, skipping');
    }
  }

  /**
   * Calculate hours between a date and now.
   */
  private getTimeDiffHours(date: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Format date for sitemap lastmod matching Go backend.
   * Go uses time.Now().Format(time.RFC3339) which produces "2006-01-02T15:04:05Z"
   * (no milliseconds). toISOString() includes milliseconds, so we strip them.
   */
  private formatLastmod(date: Date): string {
    // Remove milliseconds from ISO string: "2024-01-01T12:00:00.123Z" → "2024-01-01T12:00:00Z"
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * Format priority matching Go float32 formatting.
   * Go's float32 drops trailing zeros: 1.0 → "1", 0.9 → "0.9", 0.5 → "0.5"
   */
  private formatPriority(priority: number): string {
    const str = priority.toFixed(1);
    // Drop trailing ".0" for whole numbers
    if (str.endsWith('.0')) return str.slice(0, -2);
    return str;
  }
}
