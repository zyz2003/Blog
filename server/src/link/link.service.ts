import { Inject, Injectable, Logger, BadRequestException, NotFoundException, forwardRef } from '@nestjs/common';
import { LinkRepository, CreateLinkParams } from './link.repository';
import { LinkApplyRateLimiter } from './link-apply-rate-limiter';
import { SettingsService } from '../settings/settings.service';
import { ScheduleService } from '../schedule/schedule.service';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { ErrorCodes } from '../common/constants/error-codes';
import { ApplyLinkRequestDto } from './dto/apply-link-request.dto';
import { AdminCreateLinkRequestDto } from './dto/admin-create-link-request.dto';
import { UpdateLinkRequestDto } from './dto/update-link-request.dto';
import { ReviewLinkRequestDto } from './dto/review-link-request.dto';
import { BatchDeleteLinksRequestDto } from './dto/batch-delete-links-request.dto';
import { BatchUpdateSortRequestDto } from './dto/batch-update-sort-request.dto';
import { ImportLinksRequestDto, ImportLinkItemDto } from './dto/import-links-request.dto';
import { LinkResponseDto } from './dto/link-response.dto';
import { LinkCategoryResponseDto } from './dto/link-category-response.dto';
import { LinkTagResponseDto } from './dto/link-tag-response.dto';
import { LinkListResponseDto } from './dto/link-list-response.dto';
import { ImportLinksResponseDto, ImportLinkFailure, ImportLinkSkipped } from './dto/import-links-response.dto';
import { ExportLinksResponseDto, ExportLinkItem } from './dto/export-links-response.dto';
import { CheckExistsResponseDto } from './dto/check-exists-response.dto';
import { HealthCheckStatusDto, HealthCheckResult } from './dto/health-check-status.dto';
import { CreateCategoryRequestDto } from './dto/create-category-request.dto';
import { UpdateCategoryRequestDto } from './dto/update-category-request.dto';
import { CreateTagRequestDto } from './dto/create-tag-request.dto';
import { UpdateTagRequestDto } from './dto/update-tag-request.dto';

/**
 * Settings keys used by the link module, matching Go constant keys.
 */
const SETTINGS_KEYS = {
  APPLY_LIMIT: 'friend_link_apply_limit',
  DEFAULT_CATEGORY: 'friend_link_default_category',
  PUSHOO_CHANNEL: 'pushoo_channel',
  PUSHOO_URL: 'pushoo_url',
  PUSHOO_TOKEN: 'pushoo_token',
  NOTIFY_ADMIN: 'friend_link_notify_admin',
  SITESHOT_API: 'friend_link_siteshot_api',
  SITESHOT_KEY: 'friend_link_siteshot_key',
} as const;

/**
 * LinkService — core business logic for friend link operations.
 * Matches Go pkg/service/link/service.go exactly.
 *
 * Per D-170: ApplyLink full flow with rate limit, URL dedup, Pushoo notification.
 * Per D-171: Rate limiter uses IP-dimension daily limit.
 * Per D-172: Health check runs async with 10s timeout and max 10 concurrent.
 * Per D-173: ImportLinks handles category/tag resolution and dedup.
 * Per D-174: BatchUpdateSort, getRandomLinks, checkLinkExists.
 * Per D-175: Link IDs encoded with EntityType.Link.
 * Per D-176: Pushoo notification on ApplyLink.
 * Per D-177: Card style requires siteshot.
 * Per D-178: listPublicLinks grouped by category.
 * Per D-179: Single tag per link (not array).
 */
@Injectable()
export class LinkService {
  private readonly logger = new Logger(LinkService.name);

  /** In-memory health check status (shared across requests) */
  private healthCheckStatus: HealthCheckStatusDto = {
    is_running: false,
    start_time: null,
    end_time: null,
    result: null,
    error: '',
  };

  constructor(
    private readonly repo: LinkRepository,
    private readonly linkApplyRateLimiter: LinkApplyRateLimiter,
    private readonly settingsService: SettingsService,
    // ScheduleService for on-demand link cleanup dispatch
    // ScheduleModule is @Global, so no forwardRef needed
    private readonly scheduleService: ScheduleService,
  ) {}

  // ============================================================
  // TOLINKRESPONSEDTO — per D-175, D-179
  // ============================================================

  /**
   * Convert a link record to API response DTO.
   * Per D-175: link ID encoded with EntityType.Link using generatePublicID.
   * Per D-179: category and tag IDs are raw integers (NOT Sqids-encoded),
   * matching Go backend LinkCategoryDTO/LinkTagDTO which use int IDs.
   */
  async toLinkResponseDTO(
    link: any,
    category?: any | null,
    tag?: any | null,
  ): Promise<LinkResponseDto> {
    const dto = new LinkResponseDto();
    dto.id = generatePublicID(link.id, EntityType.Link) as any;
    dto.name = link.name;
    dto.url = link.url;
    dto.rss_url = link.rssUrl ?? undefined;
    dto.logo = link.logo ?? '';
    dto.description = link.description ?? '';
    dto.status = link.status;
    dto.siteshot = link.siteshot ?? undefined;
    dto.email = link.email ?? undefined;
    dto.type = link.type ?? undefined;
    dto.original_url = link.originalUrl ?? undefined;
    dto.update_reason = link.updateReason ?? undefined;
    dto.sort_order = link.sortOrder ?? 0;
    dto.skip_health_check = link.skipHealthCheck ?? false;

    // Category with raw integer ID (not Sqids-encoded)
    if (category) {
      const catDto = new LinkCategoryResponseDto();
      catDto.id = category.id;
      catDto.name = category.name;
      catDto.style = category.style;
      catDto.description = category.description ?? '';
      dto.category = catDto;
    } else {
      dto.category = null;
    }

    // Tag with raw integer ID (not Sqids-encoded)
    if (tag) {
      const tagDto = new LinkTagResponseDto();
      tagDto.id = tag.id;
      tagDto.name = tag.name;
      tagDto.color = tag.color;
      dto.tag = tagDto;
    } else {
      dto.tag = null;
    }

    return dto;
  }

  // ============================================================
  // APPLYLINK — per D-170, D-171, D-176, D-177
  // ============================================================

  /**
   * Apply for a friend link.
   * Per D-170: full validation pipeline.
   * Per D-171: rate limiting by IP.
   * Per D-176: Pushoo notification.
   * Per D-177: card style requires siteshot.
   */
  async applyLink(
    dto: ApplyLinkRequestDto,
    ip: string,
  ): Promise<LinkResponseDto> {
    // 1. Rate limit check per D-171
    const maxPerDayStr = this.settingsService.get(SETTINGS_KEYS.APPLY_LIMIT) || '1';
    const maxPerDay = parseInt(maxPerDayStr, 10) || 1;
    this.linkApplyRateLimiter.checkLimit(ip, maxPerDay);

    // 2. Normalize email
    const email = dto.email.toLowerCase().trim();

    // 3. Check email repeat (CAPTCHA check deferred per CONTEXT.md)
    const isRepeat = await this.repo.hasApplicationByEmail(email);
    if (isRepeat) {
      this.logger.warn(`重复申请人: ${email}，CAPTCHA验证已跳过（功能待实现）`);
    }

    // 4. Check URL exists per D-170
    const existingLink = await this.repo.findByUrl(dto.url);
    if (existingLink && dto.type === 'NEW') {
      throw new BadRequestException(ErrorCodes.LINK_URL_EXISTS);
    }
    // If type=UPDATE and URL exists, the existing link's originalUrl should be set
    // (handled below in creation)

    // 5. Get default category per D-170
    const defaultCategoryIdStr = this.settingsService.get(SETTINGS_KEYS.DEFAULT_CATEGORY) || '2';
    const defaultCategoryId = parseInt(defaultCategoryIdStr, 10) || 2;
    const category = await this.repo.findCategoryById(defaultCategoryId);
    if (!category) {
      throw new BadRequestException(ErrorCodes.LINK_CATEGORY_NOT_FOUND);
    }

    // 6. Check card style siteshot per D-177
    if (category.style === 'card' && !dto.siteshot) {
      throw new BadRequestException(ErrorCodes.LINK_SITESHOT_REQUIRED);
    }

    // 7. Create link with PENDING status
    const createParams: CreateLinkParams = {
      name: dto.name,
      url: dto.url,
      rssUrl: dto.rss_url ?? null,
      logo: dto.logo ?? null,
      description: dto.description ?? null,
      status: 'PENDING',
      siteshot: dto.siteshot ?? null,
      email,
      type: dto.type ?? null,
      originalUrl: dto.original_url ?? (dto.type === 'UPDATE' && existingLink ? existingLink.url : null),
      updateReason: dto.update_reason ?? null,
      sortOrder: 0,
      skipHealthCheck: false,
      categoryId: defaultCategoryId,
    };

    const createdLink = await this.repo.create(createParams);

    // 8. Async siteshot fetch per D-177
    if (!dto.siteshot) {
      this.fireAsyncSiteshotFetch(createdLink);
    }

    // 9. Pushoo notification per D-176
    this.firePushooNotification(createdLink);

    // 10. Return response DTO
    return this.toLinkResponseDTO(createdLink, category, null);
  }

  // ============================================================
  // LISTPUBLICLINKS — per D-178
  // ============================================================

  /**
   * Get APPROVED links grouped by category.
   * Per D-178: only include categories that have at least one APPROVED link.
   */
  async listPublicLinks(): Promise<LinkCategoryResponseDto[]> {
    const rows = await this.repo.findApprovedLinks();

    // Group by category
    const categoryMap = new Map<number, { category: any; links: any[] }>();

    for (const row of rows) {
      const catId = row.category?.id ?? 0;
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, { category: row.category, links: [] });
      }
      categoryMap.get(catId)!.links.push(row);
    }

    // Build response
    const result: LinkCategoryResponseDto[] = [];
    for (const [, group] of categoryMap) {
      if (!group.category) continue;

      const catDto = new LinkCategoryResponseDto();
      catDto.id = group.category.id;
      catDto.name = group.category.name;
      catDto.style = group.category.style;
      catDto.description = group.category.description ?? '';

      const linkDtos: LinkResponseDto[] = [];
      for (const row of group.links) {
        linkDtos.push(await this.toLinkResponseDTO(row.link, row.category, row.tag));
      }

      catDto.links = linkDtos;
      result.push(catDto);
    }

    return result;
  }

  // ============================================================
  // GETRANDOMLINKS — per D-174
  // ============================================================

  /**
   * Get random APPROVED links.
   * Per D-174: if count=0, return all APPROVED links; if count>0, return N random.
   * Go backend defaults num=5 when <=0, max 20.
   */
  async getRandomLinks(count: number): Promise<LinkResponseDto[]> {
    // Match Go backend: default 5 when <=0, max 20
    if (count <= 0) count = 5;
    if (count > 20) count = 20;

    const rows = await this.repo.findRandomApproved(count);
    const result: LinkResponseDto[] = [];
    for (const row of rows) {
      result.push(await this.toLinkResponseDTO(row.link, row.category, row.tag));
    }
    return result;
  }

  // ============================================================
  // CHECKLINKEXISTS — per D-174
  // ============================================================

  /**
   * Check if an APPROVED link exists with the given URL.
   * Per D-174: returns {exists: boolean, url}.
   */
  async checkLinkExists(url: string): Promise<CheckExistsResponseDto> {
    const link = await this.repo.findByUrl(url);
    const result = new CheckExistsResponseDto();
    result.exists = !!link && link.status === 'APPROVED';
    result.url = url;
    return result;
  }

  // ============================================================
  // LISTAPPLICATIONS — per D-174
  // ============================================================

  /**
   * Get all link applications (all statuses).
   * Per D-174: public endpoint showing all applications.
   */
  async listApplications(): Promise<LinkResponseDto[]> {
    // Get all non-deleted links (all statuses)
    const { list } = await this.repo.adminList({
      page: 1,
      pageSize: 10000,
    });

    const result: LinkResponseDto[] = [];
    for (const row of list) {
      result.push(await this.toLinkResponseDTO(row.link, row.category, row.tag));
    }
    return result;
  }

  // ============================================================
  // ADMIN CREATE — per D-170
  // ============================================================

  /**
   * Admin create a link with specified status and category/tag.
   */
  async adminCreateLink(dto: AdminCreateLinkRequestDto): Promise<LinkResponseDto> {
    const createParams: CreateLinkParams = {
      name: dto.name,
      url: dto.url,
      rssUrl: dto.rss_url ?? null,
      logo: dto.logo ?? null,
      description: dto.description ?? null,
      status: dto.status,
      siteshot: dto.siteshot ?? null,
      email: dto.email ?? null,
      type: dto.type ?? null,
      originalUrl: dto.original_url ?? null,
      updateReason: dto.update_reason ?? null,
      sortOrder: dto.sort_order ?? 0,
      skipHealthCheck: dto.skip_health_check ?? false,
      categoryId: dto.category_id,
    };

    const createdLink = await this.repo.create(createParams);

    // Set link-tag pivot if tag_id provided
    if (dto.tag_id !== undefined && dto.tag_id !== null) {
      await this.repo.setLinkTag(createdLink.id, dto.tag_id);
    }

    // Get category and tag for response
    const category = await this.repo.findCategoryById(dto.category_id);
    const tag = dto.tag_id ? await this.repo.findTagById(dto.tag_id) : null;

    return this.toLinkResponseDTO(createdLink, category, tag);
  }

  // ============================================================
  // ADMIN LIST — per D-170
  // ============================================================

  /**
   * Admin list links with pagination and filters.
   */
  async adminListLinks(filters: {
    page?: number;
    pageSize?: number;
    status?: string;
    categoryId?: number;
    tagId?: number;
  }): Promise<LinkListResponseDto> {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;

    const { list, total } = await this.repo.adminList({
      page,
      pageSize,
      status: filters.status,
      categoryId: filters.categoryId,
      tagId: filters.tagId,
    });

    const linkDtos: LinkResponseDto[] = [];
    for (const row of list) {
      linkDtos.push(await this.toLinkResponseDTO(row.link, row.category, row.tag));
    }

    const result = new LinkListResponseDto();
    result.list = linkDtos;
    result.total = total;
    result.page = page;
    result.pageSize = pageSize;
    return result;
  }

  // ============================================================
  // ADMIN UPDATE — per D-170
  // ============================================================

  /**
   * Admin update a link.
   * Per D-170: if link was APPROVED and status is changing, set status='UPDATED'
   * (requires re-review).
   */
  async adminUpdateLink(
    publicId: string,
    dto: UpdateLinkRequestDto,
  ): Promise<LinkResponseDto> {
    // Decode public ID
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicId);
    } catch {
      throw new NotFoundException(ErrorCodes.LINK_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Link) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    // Get existing link
    const existing = await this.repo.findById(decoded.dbID);
    if (!existing) {
      throw new BadRequestException(ErrorCodes.LINK_NOT_FOUND);
    }

    // If link was APPROVED and status is changing, set status='UPDATED' per D-170
    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.url !== undefined) updateData.url = dto.url;
    if (dto.rss_url !== undefined) updateData.rssUrl = dto.rss_url;
    if (dto.logo !== undefined) updateData.logo = dto.logo;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category_id !== undefined) updateData.categoryId = dto.category_id;
    if (dto.status !== undefined) {
      if (existing.status === 'APPROVED' && dto.status !== 'APPROVED') {
        updateData.status = 'UPDATED';
      } else {
        updateData.status = dto.status;
      }
    }
    if (dto.siteshot !== undefined) updateData.siteshot = dto.siteshot;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.original_url !== undefined) updateData.originalUrl = dto.original_url;
    if (dto.update_reason !== undefined) updateData.updateReason = dto.update_reason;
    if (dto.sort_order !== undefined) updateData.sortOrder = dto.sort_order;
    if (dto.skip_health_check !== undefined) updateData.skipHealthCheck = dto.skip_health_check;

    const updatedLink = await this.repo.update(decoded.dbID, updateData);

    // Update link-tag pivot if tag_id provided
    if (dto.tag_id !== undefined) {
      await this.repo.setLinkTag(decoded.dbID, dto.tag_id);
    }

    // Get category and tag for response
    const categoryId = dto.category_id ?? existing.categoryId;
    const category = await this.repo.findCategoryById(categoryId);
    const tag = await this.repo.getLinkTag(decoded.dbID);

    return this.toLinkResponseDTO(updatedLink, category, tag);
  }

  // ============================================================
  // ADMIN DELETE — per D-170
  // ============================================================

  /**
   * Soft-delete a link by public ID.
   */
  async adminDeleteLink(publicId: string): Promise<void> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicId);
    } catch {
      throw new NotFoundException(ErrorCodes.LINK_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Link) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }
    await this.repo.softDelete([decoded.dbID]);

    // Dispatch link cleanup after deletion
    // Matches Go: linkSvc.Delete() dispatches LinkCleanupJob
    this.scheduleService.dispatchLinkCleanup();
  }

  // ============================================================
  // ADMIN BATCH DELETE — per D-170
  // ============================================================

  /**
   * Soft-delete multiple links.
   * Returns {total, success, failed, failed_list}.
   */
  async adminBatchDeleteLinks(
    dto: BatchDeleteLinksRequestDto,
  ): Promise<{ total: number; success: number; failed: number; failed_list: Array<{ id: string; reason: string }> }> {
    const result = {
      total: dto.ids.length,
      success: 0,
      failed: 0,
      failed_list: [] as Array<{ id: string; reason: string }>,
    };

    const validDbIds: number[] = [];

    for (const publicId of dto.ids) {
      try {
        const decoded = decodePublicID(publicId);
        if (decoded.entityType !== EntityType.Link) {
          result.failed++;
          result.failed_list.push({ id: publicId, reason: ErrorCodes.INVALID_PUBLIC_ID });
          continue;
        }
        validDbIds.push(decoded.dbID);
      } catch {
        result.failed++;
        result.failed_list.push({ id: publicId, reason: ErrorCodes.INVALID_PUBLIC_ID });
      }
    }

    if (validDbIds.length > 0) {
      try {
        await this.repo.softDelete(validDbIds);
        result.success = validDbIds.length;

        // Dispatch link cleanup after batch deletion
        // Matches Go: linkSvc.Delete() dispatches LinkCleanupJob
        this.scheduleService.dispatchLinkCleanup();
      } catch (error) {
        result.failed += validDbIds.length;
        for (const dbId of validDbIds) {
          result.failed_list.push({ id: String(dbId), reason: String(error) });
        }
      }
    }

    return result;
  }

  // ============================================================
  // REVIEWLINK — per D-170
  // ============================================================

  /**
   * Review a link application.
   * Per D-170: validates card style siteshot requirement.
   */
  async reviewLink(
    publicId: string,
    dto: ReviewLinkRequestDto,
  ): Promise<void> {
    // Decode public ID
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicId);
    } catch {
      throw new NotFoundException(ErrorCodes.LINK_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Link) {
      throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
    }

    // Get existing link
    const link = await this.repo.findById(decoded.dbID);
    if (!link) {
      throw new BadRequestException(ErrorCodes.LINK_NOT_FOUND);
    }

    // If approving, check card style siteshot per D-170
    if (dto.status === 'APPROVED') {
      if (link.categoryId) {
        const category = await this.repo.findCategoryById(link.categoryId);
        if (category && category.style === 'card') {
          if (!dto.siteshot || dto.siteshot === '') {
            throw new BadRequestException(ErrorCodes.LINK_SITESHOT_REQUIRED);
          }
        }
      }
    }

    // Update status
    await this.repo.updateStatus(
      decoded.dbID,
      dto.status,
      dto.siteshot,
      dto.reject_reason,
    );
  }

  // ============================================================
  // IMPORTLINKS — per D-173
  // ============================================================

  /**
   * Import links with category/tag resolution and dedup.
   * Per D-173: max 1000 links, supports create_categories, create_tags, skip_duplicates.
   */
  async importLinks(dto: ImportLinksRequestDto): Promise<ImportLinksResponseDto> {
    const response = new ImportLinksResponseDto();
    response.total = dto.links.length;
    response.success = 0;
    response.failed = 0;
    response.skipped = 0;
    response.success_list = [];
    response.failed_list = [];
    response.skipped_list = [];

    // Build category and tag caches
    const categoryCache = new Map<string, any>();
    const tagCache = new Map<string, any>();

    const allCategories = await this.repo.findAllCategories();
    for (const cat of allCategories) {
      categoryCache.set(cat.name, cat);
    }

    const allTags = await this.repo.findAllTags();
    for (const tag of allTags) {
      tagCache.set(tag.name, tag);
    }

    // Get default category ID
    let defaultCategoryId: number;
    if (dto.default_category_id && dto.default_category_id > 0) {
      defaultCategoryId = dto.default_category_id;
    } else {
      const defaultCatStr = this.settingsService.get(SETTINGS_KEYS.DEFAULT_CATEGORY) || '2';
      defaultCategoryId = parseInt(defaultCatStr, 10) || 2;
    }

    // Track processed URLs for intra-import dedup
    const processedURLs = new Map<string, Set<number>>();

    for (const linkItem of dto.links) {
      try {
        // 1. Resolve category
        let categoryId = defaultCategoryId;
        if (linkItem.category_name) {
          const cached = categoryCache.get(linkItem.category_name);
          if (cached) {
            categoryId = cached.id;
          } else if (dto.create_categories) {
            const newCat = await this.repo.createCategory({
              name: linkItem.category_name,
              style: 'list',
              description: `导入时自动创建的分类：${linkItem.category_name}`,
            });
            categoryCache.set(linkItem.category_name, newCat);
            categoryId = newCat.id;
          }
          // If not found and create_categories=false, use default
        }

        // 2. Check intra-import dedup
        if (processedURLs.has(linkItem.url) && processedURLs.get(linkItem.url)!.has(categoryId)) {
          response.skipped++;
          const skipped = new ImportLinkSkipped();
          skipped.link = linkItem;
          skipped.reason = '同一URL在该分类已在本次导入中处理，已跳过';
          response.skipped_list.push(skipped);
          continue;
        }

        // 3. If skip_duplicates, check DB for existing URL+category
        if (dto.skip_duplicates) {
          const existingLink = await this.repo.findByUrl(linkItem.url);
          if (existingLink && existingLink.categoryId === categoryId) {
            response.skipped++;
            const skipped = new ImportLinkSkipped();
            skipped.link = linkItem;
            skipped.reason = '相同URL已存在于该分类，按照跳过策略忽略';
            response.skipped_list.push(skipped);
            if (!processedURLs.has(linkItem.url)) {
              processedURLs.set(linkItem.url, new Set());
            }
            processedURLs.get(linkItem.url)!.add(categoryId);
            continue;
          }
        }

        // 4. Resolve tag
        let tagId: number | null = null;
        if (linkItem.tag_name) {
          const cachedTag = tagCache.get(linkItem.tag_name);
          if (cachedTag) {
            tagId = cachedTag.id;
          } else if (dto.create_tags) {
            const newTag = await this.repo.createTag({
              name: linkItem.tag_name,
              color: linkItem.tag_color || '#409EFF',
            });
            tagCache.set(linkItem.tag_name, newTag);
            tagId = newTag.id;
          }
        }

        // 5. Set default status
        const status = linkItem.status || 'PENDING';

        // 6. Create link
        const createParams: CreateLinkParams = {
          name: linkItem.name,
          url: linkItem.url,
          rssUrl: linkItem.rss_url ?? null,
          logo: linkItem.logo ?? null,
          description: linkItem.description ?? null,
          status,
          siteshot: linkItem.siteshot ?? null,
          email: linkItem.email ?? null,
          categoryId,
        };

        const createdLink = await this.repo.create(createParams);

        // Set link-tag pivot if tag resolved
        if (tagId !== null) {
          await this.repo.setLinkTag(createdLink.id, tagId);
        }

        // Get category and tag for response
        const category = categoryCache.get(linkItem.category_name || '') ||
          await this.repo.findCategoryById(categoryId);
        const tag = tagId ? (tagCache.get(linkItem.tag_name || '') || await this.repo.findTagById(tagId)) : null;

        response.success++;
        response.success_list.push(await this.toLinkResponseDTO(createdLink, category, tag));

        // Mark as processed
        if (!processedURLs.has(linkItem.url)) {
          processedURLs.set(linkItem.url, new Set());
        }
        processedURLs.get(linkItem.url)!.add(categoryId);
      } catch (error) {
        response.failed++;
        const failure = new ImportLinkFailure();
        failure.link = linkItem;
        failure.reason = String(error);
        response.failed_list.push(failure);
      }
    }

    return response;
  }

  // ============================================================
  // EXPORTLINKS — per D-173
  // ============================================================

  /**
   * Export links in ImportLinkItem format.
   * Per D-173: get all matching links, convert to import format.
   */
  async exportLinks(filters?: {
    status?: string;
    categoryId?: number;
    tagId?: number;
  }): Promise<ExportLinksResponseDto> {
    const { list } = await this.repo.adminList({
      page: 1,
      pageSize: 10000,
      status: filters?.status,
      categoryId: filters?.categoryId,
      tagId: filters?.tagId,
    });

    const exportLinks: ExportLinkItem[] = [];
    for (const row of list) {
      const item = new ExportLinkItem();
      item.name = row.link.name;
      item.url = row.link.url;
      item.rss_url = row.link.rssUrl ?? undefined;
      item.logo = row.link.logo ?? undefined;
      item.description = row.link.description ?? undefined;
      item.siteshot = row.link.siteshot ?? undefined;
      item.email = row.link.email ?? undefined;
      item.status = row.link.status;

      if (row.category) {
        item.category_name = row.category.name;
      }
      if (row.tag) {
        item.tag_name = row.tag.name;
        item.tag_color = row.tag.color;
      }

      exportLinks.push(item);
    }

    const result = new ExportLinksResponseDto();
    result.links = exportLinks;
    result.total = exportLinks.length;
    return result;
  }

  // ============================================================
  // HEALTHCHECK — per D-172
  // ============================================================

  /**
   * Trigger async health check.
   * Per D-172: checks APPROVED and INVALID links, max 10 concurrent, 10s timeout.
   * Returns immediately; check status via getHealthCheckStatus().
   */
  async healthCheck(): Promise<void> {
    if (this.healthCheckStatus.is_running) {
      throw new BadRequestException(ErrorCodes.LINK_HEALTH_CHECK_RUNNING);
    }

    // Set running status
    this.healthCheckStatus = {
      is_running: true,
      start_time: new Date().toISOString(),
      end_time: null,
      result: null,
      error: '',
    };

    // Fire async processing (do NOT await)
    this.runHealthCheckAsync();
  }

  /**
   * Force health check — bypasses is_running guard.
   * Used by LinkHealthCheckJob (cron) which should always execute.
   * Matches D-229: two entry points reuse same core logic.
   */
  async forceHealthCheck(): Promise<HealthCheckResult> {
    const links = await this.repo.findLinksForHealthCheck();

    const result: HealthCheckResult = {
      total: links.length,
      healthy: 0,
      unhealthy: 0,
      unhealthy_ids: [],
    };

    if (links.length === 0) return result;

    const toInvalidIds: number[] = [];
    const toApprovedIds: number[] = [];

    // Process with max 10 concurrent
    const CONCURRENCY = 10;
    let activeCount = 0;
    let index = 0;

    await new Promise<void>((resolve) => {
      const processNext = () => {
        while (activeCount < CONCURRENCY && index < links.length) {
          const link = links[index++];
          activeCount++;

          this.checkSingleLink(link.url)
            .then((isHealthy) => {
              if (isHealthy) {
                result.healthy++;
                if (link.status === 'INVALID') {
                  toApprovedIds.push(link.id);
                }
              } else {
                result.unhealthy++;
                if (link.status === 'APPROVED') {
                  toInvalidIds.push(link.id);
                  result.unhealthy_ids.push(link.id);
                }
              }
              activeCount--;
              processNext();
            })
            .catch(() => {
              result.unhealthy++;
              if (link.status === 'APPROVED') {
                toInvalidIds.push(link.id);
                result.unhealthy_ids.push(link.id);
              }
              activeCount--;
              processNext();
            });
        }

        if (activeCount === 0 && index >= links.length) {
          resolve();
        }
      };

      processNext();
    });

    // Batch update statuses
    for (const id of toInvalidIds) {
      await this.repo.updateStatus(id, 'INVALID');
    }
    for (const id of toApprovedIds) {
      await this.repo.updateStatus(id, 'APPROVED');
    }

    return result;
  }

  /**
   * Get current health check status.
   */
  getHealthCheckStatus(): HealthCheckStatusDto {
    return { ...this.healthCheckStatus };
  }

  /**
   * Async health check execution.
   * Per D-172: HTTP GET with 10s timeout, max 10 concurrent.
   */
  private async runHealthCheckAsync(): Promise<void> {
    try {
      const links = await this.repo.findLinksForHealthCheck();

      const result: HealthCheckResult = {
        total: links.length,
        healthy: 0,
        unhealthy: 0,
        unhealthy_ids: [],
      };

      if (links.length === 0) {
        this.healthCheckStatus = {
          is_running: false,
          start_time: this.healthCheckStatus.start_time,
          end_time: new Date().toISOString(),
          result,
          error: '',
        };
        return;
      }

      const toInvalidIds: number[] = [];
      const toApprovedIds: number[] = [];

      // Process with max 10 concurrent
      const CONCURRENCY = 10;
      let activeCount = 0;
      let index = 0;

      await new Promise<void>((resolve) => {
        const processNext = () => {
          while (activeCount < CONCURRENCY && index < links.length) {
            const link = links[index++];
            activeCount++;

            // Fire health check
            this.checkSingleLink(link.url)
              .then((isHealthy) => {
                if (isHealthy) {
                  result.healthy++;
                  if (link.status === 'INVALID') {
                    toApprovedIds.push(link.id);
                  }
                } else {
                  result.unhealthy++;
                  if (link.status === 'APPROVED') {
                    toInvalidIds.push(link.id);
                    result.unhealthy_ids.push(link.id);
                  }
                }
                activeCount--;
                processNext();
              })
              .catch(() => {
                result.unhealthy++;
                if (link.status === 'APPROVED') {
                  toInvalidIds.push(link.id);
                  result.unhealthy_ids.push(link.id);
                }
                activeCount--;
                processNext();
              });
          }

          if (activeCount === 0 && index >= links.length) {
            resolve();
          }
        };

        processNext();
      });

      // Batch update statuses
      for (const id of toInvalidIds) {
        await this.repo.updateStatus(id, 'INVALID');
      }
      for (const id of toApprovedIds) {
        await this.repo.updateStatus(id, 'APPROVED');
      }

      this.healthCheckStatus = {
        is_running: false,
        start_time: this.healthCheckStatus.start_time,
        end_time: new Date().toISOString(),
        result,
        error: '',
      };
    } catch (error) {
      this.healthCheckStatus = {
        is_running: false,
        start_time: this.healthCheckStatus.start_time,
        end_time: new Date().toISOString(),
        result: null,
        error: String(error),
      };
    }
  }

  /**
   * Check a single link URL health.
   * Per D-172: HTTP GET with 10s timeout, 2xx/3xx = healthy.
   */
  private async checkSingleLink(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkHealthChecker/1.0)',
        },
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }

  // ============================================================
  // BATCHUPDATESORT — per D-174
  // ============================================================

  /**
   * Batch update sortOrder for multiple links.
   * Per D-174: decode public IDs to DB IDs, update sort orders.
   */
  async batchUpdateSort(dto: BatchUpdateSortRequestDto): Promise<void> {
    const items: Array<{ id: number; sortOrder: number }> = [];

    for (const item of dto.items) {
      try {
        const decoded = decodePublicID(item.id);
        if (decoded.entityType === EntityType.Link) {
          items.push({ id: decoded.dbID, sortOrder: item.sort_order });
        }
      } catch {
        // Skip invalid IDs
      }
    }

    if (items.length > 0) {
      await this.repo.batchUpdateSort(items);
    }
  }

  // ============================================================
  // CATEGORY CRUD — per D-178
  // ============================================================

  async createCategory(dto: CreateCategoryRequestDto): Promise<LinkCategoryResponseDto> {
    const category = await this.repo.createCategory({
      name: dto.name,
      style: dto.style,
      description: dto.description ?? null,
    });

    const result = new LinkCategoryResponseDto();
    result.id = category.id;
    result.name = category.name;
    result.style = category.style;
    result.description = category.description ?? '';
    return result;
  }

  async listCategories(): Promise<LinkCategoryResponseDto[]> {
    const categories = await this.repo.findAllCategories();
    return categories.map((cat: any) => {
      const dto = new LinkCategoryResponseDto();
      dto.id = cat.id;
      dto.name = cat.name;
      dto.style = cat.style;
      dto.description = cat.description ?? '';
      return dto;
    });
  }

  async listPublicCategories(): Promise<LinkCategoryResponseDto[]> {
    const categories = await this.repo.findPublicCategories();
    return categories.map((cat: any) => {
      const dto = new LinkCategoryResponseDto();
      dto.id = cat.id;
      dto.name = cat.name;
      dto.style = cat.style;
      dto.description = cat.description ?? '';
      return dto;
    });
  }

  async updateCategory(
    publicId: string,
    dto: UpdateCategoryRequestDto,
  ): Promise<LinkCategoryResponseDto> {
    // Category IDs are raw integers (not Sqids-encoded)
    const dbId = parseInt(publicId, 10);
    if (isNaN(dbId)) {
      throw new BadRequestException(ErrorCodes.LINK_CATEGORY_NOT_FOUND);
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.style !== undefined) updateData.style = dto.style;
    if (dto.description !== undefined) updateData.description = dto.description;

    const category = await this.repo.updateCategory(dbId, updateData);

    const result = new LinkCategoryResponseDto();
    result.id = category.id;
    result.name = category.name;
    result.style = category.style;
    result.description = category.description ?? '';
    return result;
  }

  async deleteCategory(publicId: string): Promise<void> {
    // Category IDs are raw integers (not Sqids-encoded)
    const dbId = parseInt(publicId, 10);
    if (isNaN(dbId)) {
      throw new BadRequestException(ErrorCodes.LINK_CATEGORY_NOT_FOUND);
    }
    await this.repo.deleteCategoryIfUnused(dbId);
  }

  // ============================================================
  // TAG CRUD — per D-179
  // ============================================================

  async createTag(dto: CreateTagRequestDto): Promise<LinkTagResponseDto> {
    const tag = await this.repo.createTag({
      name: dto.name,
      color: dto.color,
    });

    const result = new LinkTagResponseDto();
    result.id = tag.id;
    result.name = tag.name;
    result.color = tag.color;
    return result;
  }

  async listTags(): Promise<LinkTagResponseDto[]> {
    const tags = await this.repo.findAllTags();
    return tags.map((t: any) => {
      const dto = new LinkTagResponseDto();
      dto.id = t.id;
      dto.name = t.name;
      dto.color = t.color;
      return dto;
    });
  }

  async updateTag(
    publicId: string,
    dto: UpdateTagRequestDto,
  ): Promise<LinkTagResponseDto> {
    // Tag IDs are raw integers (not Sqids-encoded)
    const dbId = parseInt(publicId, 10);
    if (isNaN(dbId)) {
      throw new BadRequestException(ErrorCodes.LINK_TAG_NOT_FOUND);
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.color !== undefined) updateData.color = dto.color;

    const tag = await this.repo.updateTag(dbId, updateData);

    const result = new LinkTagResponseDto();
    result.id = tag.id;
    result.name = tag.name;
    result.color = tag.color;
    return result;
  }

  async deleteTag(publicId: string): Promise<void> {
    // Tag IDs are raw integers (not Sqids-encoded)
    const dbId = parseInt(publicId, 10);
    if (isNaN(dbId)) {
      throw new BadRequestException(ErrorCodes.LINK_TAG_NOT_FOUND);
    }
    await this.repo.deleteTagIfUnused(dbId);
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Fire-and-forget async siteshot fetch per D-177.
   * If screenshot API is configured, fire HTTP GET to get siteshot.
   * On success, update link.siteshot. On failure, skip.
   */
  private fireAsyncSiteshotFetch(link: any): void {
    (async () => {
      try {
        const siteshotApi = this.settingsService.get(SETTINGS_KEYS.SITESHOT_API) || '';
        const siteshotKey = this.settingsService.get(SETTINGS_KEYS.SITESHOT_KEY) || '';

        if (!siteshotApi) return;

        const url = `${siteshotApi}?url=${encodeURIComponent(link.url)}${siteshotKey ? `&key=${encodeURIComponent(siteshotKey)}` : ''}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000),
        });

        if (response.ok) {
          const data = await response.json() as any;
          if (data.screenshot || data.siteshot || data.url || data.image) {
            const siteshot = data.screenshot || data.siteshot || data.url || data.image;
            await this.repo.update(link.id, { siteshot });
          }
        }
      } catch (error) {
        this.logger.warn(`友链截图获取失败: ${link.url} - ${error}`);
      }
    })();
  }

  /**
   * Fire-and-forget Pushoo notification per D-176.
   * Follows the pattern from CommentService.firePushooNotification.
   */
  private firePushooNotification(link: any): void {
    (async () => {
      try {
        const pushChannel = this.settingsService.get(SETTINGS_KEYS.PUSHOO_CHANNEL) || '';
        if (!pushChannel) return;

        const pushUrl = this.settingsService.get(SETTINGS_KEYS.PUSHOO_URL) || '';
        if (!pushUrl) return;

        const notifyAdmin = this.settingsService.get(SETTINGS_KEYS.NOTIFY_ADMIN) === 'true';
        if (!notifyAdmin) return;

        const pushToken = this.settingsService.get(SETTINGS_KEYS.PUSHOO_TOKEN) || '';
        const message = `🔗 新友链申请: ${link.name} (${link.url})`;

        const response = await fetch(pushUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: pushChannel,
            token: pushToken,
            message,
          }),
        });

        if (!response.ok) {
          this.logger.warn(`Pushoo API returned ${response.status}: ${await response.text()}`);
        }
      } catch (error) {
        this.logger.warn(`友链申请通知发送失败: ${error}`);
      }
    })();
  }
}
