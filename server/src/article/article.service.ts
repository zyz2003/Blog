import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { ArticleRepository, calculatePostStats, diffIDs } from './article.repository';
import { PostCategoryRepository } from '../post-category/post-category.repository';
import { PostTagRepository } from '../post-tag/post-tag.repository';
import { ArticleHistoryService } from '../article-history/article-history.service';
import { DRIZZLE } from '../database/database.module';
import { articles } from '../database/schemas/article.schema';
import { generatePublicID, decodePublicID, EntityType } from '../common/utils/sqids.util';
import { formatToChinaTime, toISODateString } from '../common/utils/time.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { sanitizeHtml } from './article.sanitize';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { ArticleResponseDto } from './dto/article-response.dto';
import {
  ArticleListResponseDto,
  SimpleArticleResponseDto,
  ArticleDetailResponseDto,
  ArchiveSummaryResponseDto,
  ArticleStatisticsDto,
  TopViewedPostItemDto,
  PublishTrendItemDto,
} from './dto/article-response.dto';
import { eq, isNull, and, sql } from 'drizzle-orm';

/** Reserved paths that abbrlink cannot match (from Go service.go) */
const RESERVED_PATHS = [
  'posts', 'page', 'tags', 'categories', 'archives', 'about', 'link',
  'admin', 'api', 'login', 'redirect', 'album', 'music', 'external-link-warning',
  'activate', 'error', 'static', 'random-post', 'air-conditioner', 'equipment',
  'recentcomments', 'update', 'doc', 'essay', 'sitemap', 'robots.txt', 'feed',
  'rss', 'atom', 'search', 'privacy', 'copyright', '404', '500',
];

@Injectable()
export class ArticleService {
  constructor(
    private readonly articleRepo: ArticleRepository,
    private readonly categoryRepo: PostCategoryRepository,
    private readonly tagRepo: PostTagRepository,
    private readonly historyService: ArticleHistoryService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  /**
   * Map article DB row to Go-compatible ArticleResponse.
   * Matches Go ToAPIResponse (service.go lines 616-692) exactly.
   */
  toApiResponse(
    article: any,
    useAbbrlinkAsID: boolean,
    includeHTML: boolean,
  ): ArticleResponseDto {
    if (!article) return null as any;

    // Response ID: use abbrlink if requested and available
    const responseID =
      useAbbrlinkAsID && article.abbrlink
        ? article.abbrlink
        : generatePublicID(article.id, EntityType.Article);

    // Effective top image: topImgUrl falls back to coverUrl (Go lines 634-637)
    const effectiveTopImgUrl = article.topImgUrl || article.coverUrl || null;

    // Map nested tags
    const postTags = (article.postTags || []).map((tag: any) => ({
      id: generatePublicID(tag.id, EntityType.PostTag),
      created_at: toISODateString(tag.createdAt),
      updated_at: toISODateString(tag.updatedAt),
      name: tag.name,
      slug: tag.slug ?? null,
      count: tag.count ?? 0,
    }));

    // Map nested categories
    const postCategories = (article.postCategories || []).map((cat: any) => ({
      id: generatePublicID(cat.id, EntityType.PostCategory),
      created_at: toISODateString(cat.createdAt),
      updated_at: toISODateString(cat.updatedAt),
      name: cat.name,
      slug: cat.slug ?? null,
      description: cat.description ?? null,
      count: cat.count ?? 0,
      is_series: cat.isSeries ?? false,
    }));

    // Doc series ID: encode via Sqids if non-null
    let docSeriesId: string | null = null;
    if (article.docSeriesId) {
      try {
        docSeriesId = generatePublicID(article.docSeriesId, EntityType.DocSeries);
      } catch {
        docSeriesId = null;
      }
    }

    // Owner info
    const owner = article.owner;
    const ownerNickname = owner?.nickname ?? null;
    const ownerAvatar = owner?.avatar ?? null;
    const ownerEmail = owner?.email ?? null;

    return {
      id: responseID,
      created_at: toISODateString(article.createdAt),
      updated_at: toISODateString(article.updatedAt),
      title: article.title,
      content_md: article.contentMd ?? null,
      content_html: includeHTML ? (article.contentHtml ?? null) : null,
      cover_url: article.coverUrl ?? null,
      status: article.status,
      view_count: article.viewCount ?? 0,
      word_count: article.wordCount ?? 0,
      reading_time: article.readingTime ?? 0,
      ip_location: article.ipLocation ?? null,
      primary_color: article.primaryColor ?? null,
      is_primary_color_manual: article.isPrimaryColorManual ?? false,
      show_on_home: article.showOnHome ?? true,
      post_tags: postTags,
      post_categories: postCategories,
      home_sort: article.homeSort ?? 0,
      pin_sort: article.pinSort ?? 0,
      top_img_url: effectiveTopImgUrl,
      summaries: article.summaries ?? null,
      abbrlink: article.abbrlink ?? null,
      copyright: article.copyright ?? true,
      is_reprint: article.isReprint ?? false,
      copyright_author: article.copyrightAuthor ?? null,
      copyright_author_href: article.copyrightAuthorHref ?? null,
      copyright_url: article.copyrightUrl ?? null,
      keywords: article.keywords ?? null,
      comment_count: 0, // Phase 06
      scheduled_at: article.scheduledAt
        ? toISODateString(article.scheduledAt)
        : null,
      review_status: article.reviewStatus ?? 'NONE',
      owner_id: article.ownerId ?? null,
      owner_nickname: ownerNickname,
      owner_avatar: ownerAvatar,
      owner_email: ownerEmail,
      is_takedown: article.isTakedown ?? false,
      takedown_reason: article.takedownReason ?? null,
      takedown_at: article.takedownAt ? toISODateString(article.takedownAt) : null,
      takedown_by: article.takedownBy ?? null,
      extra_config: article.extraConfig ?? null,
      is_doc: article.isDoc ?? false,
      doc_series_id: docSeriesId,
      doc_sort: article.docSort ?? 0,
    };
  }

  /**
   * Create article with category/tag associations and count sync.
   */
  async create(dto: CreateArticleDto, ownerDbId: number) {
    // Decode Sqids category/tag IDs to DB IDs
    const categoryDbIds = this.decodeIds(dto.post_category_ids, EntityType.PostCategory);
    const tagDbIds = this.decodeIds(dto.post_tag_ids, EntityType.PostTag);

    // Calculate wordCount/readingTime
    const { wordCount, readingTime } = calculatePostStats(dto.content_md || '');

    // Sanitize content_html per D-70
    const contentHtml = sanitizeHtml(dto.content_html);

    // Validate abbrlink uniqueness
    if (dto.abbrlink) {
      await this.validateAbbrlink(dto.abbrlink);
    }

    // Build article data
    const data: any = {
      ownerId: ownerDbId,
      title: dto.title,
      status: dto.status || 'DRAFT',
      contentMd: dto.content_md ?? null,
      contentHtml,
      coverUrl: dto.cover_url ?? null,
      wordCount,
      readingTime,
      ipLocation: dto.ip_location ?? null,
      primaryColor: dto.primary_color ?? '#b4bfe2',
      isPrimaryColorManual: dto.is_primary_color_manual ?? false,
      showOnHome: dto.show_on_home ?? true,
      homeSort: dto.home_sort ?? 0,
      pinSort: dto.pin_sort ?? 0,
      topImgUrl: dto.top_img_url ?? null,
      summaries: dto.summaries ?? null,
      abbrlink: dto.abbrlink ?? null,
      copyright: dto.copyright ?? true,
      isReprint: dto.is_reprint ?? false,
      copyrightAuthor: dto.copyright_author ?? null,
      copyrightAuthorHref: dto.copyright_author_href ?? null,
      copyrightUrl: dto.copyright_url ?? null,
      keywords: dto.keywords ?? null,
      extraConfig: dto.extra_config ?? null,
      isDoc: dto.is_doc ?? false,
      docSort: dto.doc_sort ?? 0,
    };

    // Handle doc_series_id (Sqids decode)
    if (dto.doc_series_id) {
      try {
        const decoded = decodePublicID(dto.doc_series_id);
        data.docSeriesId = decoded.dbID;
      } catch {
        // Invalid Sqids ID, ignore
      }
    }

    // Handle scheduled_at
    if (dto.scheduled_at) {
      data.scheduledAt = new Date(dto.scheduled_at);
    }

    // Create article with associations
    const article = await this.articleRepo.createWithAssociations(
      data,
      categoryDbIds,
      tagDbIds,
    );

    // Sync category/tag counts (+1)
    await this.syncCounts(categoryDbIds, tagDbIds, 'increment');

    // Fetch with relations for response
    const articleWithRelations = await this.articleRepo.findByIdWithRelations(article.id);

    // Auto-create history version=1 on Create (D-55)
    try {
      await this.historyService.createHistory(articleWithRelations, ownerDbId, '创建文章');
    } catch {
      // History creation failure should not block article creation
    }

    return this.toApiResponse(articleWithRelations, false, true);
  }

  /**
   * Update article with category/tag diff and count sync.
   */
  async update(publicId: string, dto: UpdateArticleDto, ownerDbId: number) {
    // Decode article public ID
    const { dbID } = decodePublicID(publicId);

    // Fetch existing article with relations
    const existing = await this.articleRepo.findByIdWithRelations(dbID);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }

    // Decode and compute diff for category/tag IDs
    let categoryDbIds: number[] | null = null;
    let tagDbIds: number[] | null = null;
    let categoryDiff: { inc: number[]; dec: number[] } | null = null;
    let tagDiff: { inc: number[]; dec: number[] } | null = null;

    if (dto.post_category_ids !== undefined) {
      categoryDbIds = this.decodeIds(dto.post_category_ids, EntityType.PostCategory);
      const existingCategoryIds = (existing.postCategories || []).map((c: any) => c.id);
      categoryDiff = diffIDs(existingCategoryIds, categoryDbIds);
    }

    if (dto.post_tag_ids !== undefined) {
      tagDbIds = this.decodeIds(dto.post_tag_ids, EntityType.PostTag);
      const existingTagIds = (existing.postTags || []).map((t: any) => t.id);
      tagDiff = diffIDs(existingTagIds, tagDbIds);
    }

    // Build update data
    const data: any = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.content_md !== undefined) {
      data.contentMd = dto.content_md;
      const { wordCount, readingTime } = calculatePostStats(dto.content_md || '');
      data.wordCount = wordCount;
      data.readingTime = readingTime;
    }
    if (dto.content_html !== undefined) {
      data.contentHtml = sanitizeHtml(dto.content_html);
    }
    if (dto.cover_url !== undefined) data.coverUrl = dto.cover_url;
    if (dto.ip_location !== undefined) data.ipLocation = dto.ip_location;
    if (dto.primary_color !== undefined) data.primaryColor = dto.primary_color;
    if (dto.is_primary_color_manual !== undefined) data.isPrimaryColorManual = dto.is_primary_color_manual;
    if (dto.show_on_home !== undefined) data.showOnHome = dto.show_on_home;
    if (dto.home_sort !== undefined) data.homeSort = dto.home_sort;
    if (dto.pin_sort !== undefined) data.pinSort = dto.pin_sort;
    if (dto.top_img_url !== undefined) data.topImgUrl = dto.top_img_url;
    if (dto.summaries !== undefined) data.summaries = dto.summaries;
    if (dto.copyright !== undefined) data.copyright = dto.copyright;
    if (dto.is_reprint !== undefined) data.isReprint = dto.is_reprint;
    if (dto.copyright_author !== undefined) data.copyrightAuthor = dto.copyright_author;
    if (dto.copyright_author_href !== undefined) data.copyrightAuthorHref = dto.copyright_author_href;
    if (dto.copyright_url !== undefined) data.copyrightUrl = dto.copyright_url;
    if (dto.keywords !== undefined) data.keywords = dto.keywords;
    if (dto.extra_config !== undefined) data.extraConfig = dto.extra_config;
    if (dto.is_doc !== undefined) data.isDoc = dto.is_doc;
    if (dto.doc_sort !== undefined) data.docSort = dto.doc_sort;

    // Validate abbrlink if changed
    if (dto.abbrlink !== undefined) {
      if (dto.abbrlink) {
        await this.validateAbbrlink(dto.abbrlink, dbID);
      }
      data.abbrlink = dto.abbrlink || null;
    }

    // Handle doc_series_id
    if (dto.doc_series_id !== undefined) {
      if (dto.doc_series_id) {
        try {
          const decoded = decodePublicID(dto.doc_series_id);
          data.docSeriesId = decoded.dbID;
        } catch {
          // Invalid Sqids ID, ignore
        }
      } else {
        data.docSeriesId = null;
      }
    }

    // Handle scheduled_at
    if (dto.scheduled_at !== undefined) {
      data.scheduledAt = dto.scheduled_at ? new Date(dto.scheduled_at) : null;
    }

    data.updatedAt = new Date();

    // Update article with associations
    await this.articleRepo.updateWithAssociations(dbID, data, categoryDbIds, tagDbIds);

    // Sync category/tag counts via diff
    if (categoryDiff) {
      await this.syncCounts(categoryDiff.inc, [], 'increment');
      await this.syncCounts(categoryDiff.dec, [], 'decrement');
    }
    if (tagDiff) {
      await this.syncCounts([], tagDiff.inc, 'increment');
      await this.syncCounts([], tagDiff.dec, 'decrement');
    }

    // Fetch updated article with relations
    const updated = await this.articleRepo.findByIdWithRelations(dbID);

    // Auto-create history version on Update (D-55)
    try {
      await this.historyService.createHistory(updated, ownerDbId, '更新文章');
    } catch {
      // History creation failure should not block article update
    }

    return this.toApiResponse(updated, false, true);
  }

  /**
   * Soft-delete article and sync category/tag counts (-1).
   */
  async delete(publicId: string) {
    const { dbID } = decodePublicID(publicId);

    const existing = await this.articleRepo.findByIdWithRelations(dbID);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }

    await this.articleRepo.softDelete(dbID);

    // Decrement category/tag counts
    const categoryIds = (existing.postCategories || []).map((c: any) => c.id);
    const tagIds = (existing.postTags || []).map((t: any) => t.id);
    await this.syncCounts(categoryIds, tagIds, 'decrement');

    return null;
  }

  /**
   * Get single article by public ID (admin).
   */
  async get(publicId: string) {
    const { dbID } = decodePublicID(publicId);
    const article = await this.articleRepo.findByIdWithRelations(dbID);
    if (!article) {
      throw new NotFoundException(ErrorCodes.ARTICLE_NOT_FOUND);
    }
    return this.toApiResponse(article, false, true);
  }

  /**
   * List articles with pagination and filters (admin).
   */
  async list(options: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: string;
    category?: string;
    tag?: string;
  }) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;

    const result = await this.articleRepo.list({
      page,
      pageSize,
      query: options.query,
      status: options.status,
      categoryName: options.category,
      tagName: options.tag,
    });

    return {
      list: result.list.map((a: any) => this.toApiResponse(a, false, true)),
      total: result.total,
      page,
      pageSize,
    };
  }

  /**
   * Validate abbrlink format and uniqueness.
   * Matches Go validateAbbrlink (service.go lines 556-613).
   */
  async validateAbbrlink(abbrlink: string, excludeDbId?: number) {
    if (!abbrlink) return;

    // Length limit (Go uses 200)
    if (abbrlink.length > 200) {
      throw new BadRequestException('永久链接长度不能超过200个字符');
    }

    // No forward slashes
    if (abbrlink.includes('/')) {
      throw new BadRequestException('永久链接不能包含斜杠 /（仅支持自定义文章ID，不支持路径格式）');
    }

    // Check reserved paths
    const lower = abbrlink.toLowerCase();
    if (RESERVED_PATHS.includes(lower)) {
      throw new BadRequestException(`永久链接不能以系统保留路径 '${abbrlink}' 开头`);
    }

    // Check uniqueness
    const exists = await this.articleRepo.existsByAbbrlink(abbrlink, excludeDbId);
    if (exists) {
      throw new ConflictException(`永久链接 '${abbrlink}' 已被其他文章使用`);
    }
  }

  /**
   * Decode array of Sqids public IDs to DB IDs, validating entityType.
   */
  private decodeIds(ids: string[] | undefined, expectedType: number): number[] {
    if (!ids || !Array.isArray(ids)) return [];
    return ids
      .map((id) => {
        try {
          const { dbID, entityType } = decodePublicID(id);
          if (entityType !== expectedType) return null;
          return dbID;
        } catch {
          return null;
        }
      })
      .filter((id): id is number => id !== null);
  }

  /**
   * Sync category/tag counts (increment or decrement).
   */
  private async syncCounts(
    categoryIds: number[],
    tagIds: number[],
    direction: 'increment' | 'decrement',
  ) {
    const delta = direction === 'increment' ? 1 : -1;

    for (const catId of categoryIds) {
      try {
        if (direction === 'increment') {
          await this.categoryRepo.incrementCount(catId);
        } else {
          await this.categoryRepo.decrementCount(catId);
        }
      } catch {
        // Count sync failure should not block article CRUD
      }
    }

    for (const tagId of tagIds) {
      try {
        if (direction === 'increment') {
          await this.tagRepo.incrementCount(tagId);
        } else {
          await this.tagRepo.decrementCount(tagId);
        }
      } catch {
        // Count sync failure should not block article CRUD
      }
    }
  }

  // ─── Public service methods ──────────────────────────────────────

  /**
   * List published articles with pagination and filters.
   * Matches Go ListPublic (service.go lines 1779-1825).
   */
  async listPublic(options: {
    page?: number;
    pageSize?: number;
    category?: string;
    tag?: string;
    year?: number;
    month?: number;
  }): Promise<ArticleListResponseDto> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;

    const result = await this.articleRepo.listPublic({
      page,
      pageSize,
      categoryName: options.category,
      tagName: options.tag,
      year: options.year,
      month: options.month,
    });

    return {
      list: result.list.map((a: any) => this.toApiResponse(a, true, false)),
      total: result.total,
      page,
      pageSize,
    };
  }

  /**
   * List home-visible articles. No pagination per D-51.
   * Matches Go ListHome (service.go lines 1762-1776).
   */
  async listHome(): Promise<ArticleResponseDto[]> {
    const articles = await this.articleRepo.listHome();
    return articles.map((a: any) => this.toApiResponse(a, true, false));
  }

  /**
   * Get a single random published article.
   * Matches Go GetRandom (service.go lines 1751-1759).
   */
  async getRandom(): Promise<ArticleResponseDto> {
    const article = await this.articleRepo.getRandom();
    if (!article) {
      throw new NotFoundException('没有找到已发布的文章');
    }
    return this.toApiResponse(article, true, true);
  }

  /**
   * List archives grouped by year/month.
   * Matches Go ListArchives (service.go lines 1828-1845).
   */
  async listArchives(): Promise<ArchiveSummaryResponseDto> {
    const rows = await this.articleRepo.listArchives();
    return {
      list: rows.map((r: any) => ({
        year: r.year,
        month: r.month,
        count: r.count,
      })),
    };
  }

  /**
   * Get article statistics.
   * Matches Go GetArticleStatistics (service.go lines 428-523).
   */
  async getArticleStatistics(): Promise<ArticleStatisticsDto> {
    const stats = await this.articleRepo.getArticleStatistics();

    const topViewedPosts: TopViewedPostItemDto[] = stats.topViewedPosts.map(
      (post: any) => ({
        id: generatePublicID(post.id, EntityType.Article),
        title: post.title,
        views: post.viewCount,
        cover_url: post.coverUrl ?? null,
      }),
    );

    const publishTrend: PublishTrendItemDto[] = stats.publishTrend.map(
      (item: any) => ({
        month: item.month,
        count: item.count,
      }),
    );

    return {
      total_posts: stats.totalPosts,
      total_words: stats.totalWords,
      avg_words: stats.avgWords,
      total_views: stats.totalViews,
      category_stats: stats.categoryStats,
      tag_stats: stats.tagStats,
      top_viewed_posts: topViewedPosts,
      publish_trend: publishTrend,
    };
  }

  /**
   * Get article by URL — extract slug from URL path and find article.
   * Matches Go GetByURL (handler.go lines 352-376 + extractSlugFromURL).
   */
  async getByURL(url: string): Promise<ArticleDetailResponseDto> {
    const slug = this.extractSlugFromURL(url);
    if (!slug) {
      throw new BadRequestException('无法从URL中解析出文章标识');
    }
    return this.getPublic(slug);
  }

  /**
   * Get public article detail with prev/next navigation.
   * Matches Go GetPublicBySlugOrID (service.go lines 874-973).
   * Per Pitfall 4: Go swaps prev/next — prev=newer, next=older.
   */
  async getPublic(slugOrId: string): Promise<ArticleDetailResponseDto> {
    const article = await this.articleRepo.findByAbbrlinkOrId(slugOrId);
    if (!article) {
      throw new NotFoundException('文章未找到');
    }

    // Increment view count (D-65: simple increment for Phase 03)
    await this.articleRepo.incrementViewCount(article.id);

    // Find prev/next — returns raw chronological neighbors
    const { chronoNewer, chronoOlder } = await this.articleRepo.findPrevNextArticles(
      article.id,
      article.createdAt,
    );

    // Per Go swap convention (Pitfall 4 in RESEARCH.md):
    // prevArticle = chronologically newer (creation time later = "previous" in reading order)
    // nextArticle = chronologically older (creation time earlier = "next" in reading order)
    const prevArticle = chronoNewer ? this.toSimpleApiResponse(chronoNewer) : null;
    const nextArticle = chronoOlder ? this.toSimpleApiResponse(chronoOlder) : null;

    // Main article response — useAbbrlinkAsID=true per Go GetPublic behavior
    const mainResponse = this.toApiResponse(article, true, true);

    return {
      ...mainResponse,
      prev_article: prevArticle,
      next_article: nextArticle,
      related_articles: [], // Phase 03: empty array (Go uses FindRelatedArticles, deferred)
    };
  }

  /**
   * Map article to SimpleArticleResponse.
   * Matches Go toSimpleAPIResponse (service.go lines 695-722).
   */
  toSimpleApiResponse(article: any): SimpleArticleResponseDto | null {
    if (!article) return null;

    const responseID =
      article.abbrlink || generatePublicID(article.id, EntityType.Article);

    let docSeriesId: string | null = null;
    if (article.docSeriesId) {
      try {
        docSeriesId = generatePublicID(article.docSeriesId, EntityType.DocSeries);
      } catch {
        docSeriesId = null;
      }
    }

    return {
      id: responseID,
      title: article.title,
      cover_url: article.coverUrl ?? null,
      abbrlink: article.abbrlink ?? null,
      created_at: toISODateString(article.createdAt),
      primary_color: article.primaryColor ?? null,
      is_doc: article.isDoc ?? false,
      doc_series_id: docSeriesId,
    };
  }

  /**
   * Extract slug from URL path.
   * Matches Go extractSlugFromURL (handler.go lines 378-407).
   */
  private extractSlugFromURL(rawURL: string): string {
    let path = rawURL;

    // Strip protocol (http:// or https://)
    const schemeIdx = rawURL.indexOf('://');
    if (schemeIdx >= 0) {
      const afterScheme = rawURL.substring(schemeIdx + 3);
      const slashIdx = afterScheme.indexOf('/');
      if (slashIdx >= 0) {
        path = afterScheme.substring(slashIdx);
      } else {
        return '';
      }
    }

    // Trim trailing slash
    path = path.replace(/\/+$/, '');

    // Find /posts/ prefix and extract slug
    const postsPrefix = '/posts/';
    const postsIdx = path.indexOf(postsPrefix);
    if (postsIdx >= 0) {
      let slug = path.substring(postsIdx + postsPrefix.length);
      const nextSlash = slug.indexOf('/');
      if (nextSlash >= 0) {
        slug = slug.substring(0, nextSlash);
      }
      return slug;
    }

    // Fallback: last segment of path
    const parts = path.split('/').filter((s) => s.length > 0);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }

    return '';
  }
}
