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
    items.push({
      url: `${baseURL}/link`,
      lastModified: null,
      changeFreq: 'weekly',
      priority: 0.6,
    });

    // 5. Common pages
    items.push({
      url: `${baseURL}/archives`,
      lastModified: null,
      changeFreq: 'daily',
      priority: 0.7,
    });
    items.push({
      url: `${baseURL}/categories`,
      lastModified: null,
      changeFreq: 'weekly',
      priority: 0.6,
    });
    items.push({
      url: `${baseURL}/tags`,
      lastModified: null,
      changeFreq: 'weekly',
      priority: 0.6,
    });
    items.push({
      url: `${baseURL}/about`,
      lastModified: null,
      changeFreq: 'monthly',
      priority: 0.5,
    });

    // Convert SitemapItem[] to URLSet
    return {
      urls: items.map((item) => ({
        loc: item.url,
        lastmod: item.lastModified ? item.lastModified.toISOString() : '',
        changefreq: item.changeFreq,
        priority: item.priority.toFixed(1),
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
   */
  generateRobots(): string {
    const baseURL = this.getBaseURL();
    return [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin/',
      `Sitemap: ${this.xmlEscape(baseURL)}/sitemap.xml`,
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
        pageSize: 1000,
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
   * Escape XML entities.
   * Same 5-entity replacement as RSS module (& MUST be first).
   * Used by generateRobots() for the Sitemap URL in the template.
   * generateXML() uses the XML library's built-in escaping.
   */
  private xmlEscape(s: string): string {
    if (!s) return '';
    return s
      .replace(/&/g, '&amp;') // MUST be first to avoid double-escaping
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
