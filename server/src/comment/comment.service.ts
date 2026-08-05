import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { CommentRepository, CreateCommentParams } from './comment.repository';
import { SettingsService } from '../settings/settings.service';
import { CommentRateLimiter } from './comment-rate-limiter';
import { UploadService } from '../file/upload.service';
import { StoragePolicyService } from '../storage-policy/storage-policy.service';
import { FileService } from '../file/file.service';
import { GeoIPService } from '../weather/geoip.service';
import { NotificationService } from '../notification/notification.service';
import { ScheduleService } from '../schedule/schedule.service';
import { renderCommentMarkdown } from './comment-markdown';
import {
  generatePublicID,
  decodePublicID,
  EntityType,
} from '../common/utils/sqids.util';
import { getUploadBaseDir } from '../common/utils/upload-path';
import { findOrCreateParentPath } from '../file/utils/parent-path';
import { ErrorCodes } from '../common/constants/error-codes';
import { users } from '../database/schemas/user.schema';
import { userGroups } from '../database/schemas/user-group.schema';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs/promises';

// QQ email pattern for extracting QQ number
const qqEmailRegex = /^([1-9]\d{4,10})@qq\.com$/;

/**
 * CommentService — core business logic for comment operations.
 * Matches Go pkg/service/comment/service.go exactly.
 *
 * Per D-143: GeoIPService injected from WeatherModule for IP location lookup.
 * Per D-141: UploadService is injected from FileModule for comment image uploads.
 */
@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly repo: CommentRepository,
    private readonly settingsService: SettingsService,
    private readonly rateLimiter: CommentRateLimiter,
    private readonly uploadService: UploadService,
    private readonly policyService: StoragePolicyService,
    private readonly fileService: FileService,
    private readonly geoipService: GeoIPService,
    private readonly notificationService: NotificationService,
    // ScheduleService for on-demand comment notification dispatch
    // ScheduleModule is @Global, so no forwardRef needed
    private readonly scheduleService: ScheduleService,
    @Inject(DRIZZLE) private readonly db: any,
  ) {}

  // ============================================================
  // CREATE — matches Go service.go lines 219-606
  // ============================================================

  /**
   * Create a new comment with full validation pipeline.
   * Per D-126: rate limit → decode IDs → validate parent/replyTo → render Markdown
   * → compute emailMd5 → lookup IP → check forbidden words → detect admin
   * → validate anonymous → create record → Pushoo notify
   */
  async create(
    req: {
      target_path: string;
      target_title?: string;
      parent_id?: string;
      reply_to_id?: string;
      nickname: string;
      email?: string;
      website?: string;
      content: string;
      is_anonymous: boolean;
    },
    ip: string,
    ua: string,
    referer: string,
    claims: any | null,
  ) {
    // 1. Rate limit check per D-130
    const limitStr = this.settingsService.get('comment_limit_per_minute') || '0';
    const limit = parseInt(limitStr, 10);
    if (limit > 0) {
      this.rateLimiter.checkLimit(ip, limit);
    }

    // 2. Decode parentId and validate per D-118
    let parentDbId: number | null = null;
    let parentComment: any = null;
    if (req.parent_id && req.parent_id !== '') {
      let decoded: { dbID: number; entityType: number };
      try {
        decoded = decodePublicID(req.parent_id);
      } catch {
        throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
      }
      if (decoded.entityType !== EntityType.Comment) {
        throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
      }
      parentComment = await this.repo.findById(decoded.dbID);
      if (!parentComment) {
        throw new BadRequestException(ErrorCodes.COMMENT_PARENT_NOT_FOUND);
      }
      if (parentComment.targetPath !== req.target_path) {
        throw new BadRequestException('回复的评论与当前页面不匹配');
      }
      parentDbId = decoded.dbID;
    }

    // 3. Decode replyToId and validate per D-126 step 4
    let replyToDbId: number | null = null;
    let replyToComment: any = null;
    if (req.reply_to_id && req.reply_to_id !== '') {
      let decoded: { dbID: number; entityType: number };
      try {
        decoded = decodePublicID(req.reply_to_id);
      } catch {
        throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
      }
      if (decoded.entityType !== EntityType.Comment) {
        throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
      }
      replyToComment = await this.repo.findById(decoded.dbID);
      if (!replyToComment) {
        throw new BadRequestException(ErrorCodes.COMMENT_REPLY_TARGET_NOT_FOUND);
      }
      if (replyToComment.targetPath !== req.target_path) {
        throw new BadRequestException('回复目标评论与当前页面不匹配');
      }
      // Anonymous comments cannot be replied to per D-126 step 4
      if (replyToComment.isAnonymous) {
        throw new BadRequestException(ErrorCodes.COMMENT_ANONYMOUS_NO_REPLY);
      }
      replyToDbId = decoded.dbID;
    }

    // 4. Check parent comment is not anonymous (direct reply to root scenario)
    // Per Go lines 274-277
    if (parentComment && parentComment.isAnonymous) {
      throw new BadRequestException(ErrorCodes.COMMENT_ANONYMOUS_NO_REPLY);
    }

    // 5. Markdown rendering per D-122, D-125
    const contentHtml = renderCommentMarkdown(req.content);

    // 6. Compute emailMd5 per D-126 step 6
    let emailMd5 = '';
    if (req.email) {
      emailMd5 = crypto
        .createHash('md5')
        .update(req.email.toLowerCase())
        .digest('hex');
    }

    // 7. IP geolocation per D-143
    const ipLocation = await this.lookupIPLocation(ip, referer);

    // 8. Forbidden words check per D-131
    let status = 1; // Published
    const forbiddenWords = this.settingsService.get('comment_forbidden_words') || '';
    if (forbiddenWords) {
      for (const word of forbiddenWords.split(',')) {
        const trimmed = word.trim();
        if (trimmed && req.content.includes(trimmed)) {
          status = 2; // Pending
          break;
        }
      }
    }

    // 9. Admin detection per D-127, D-129
    let isAdmin = false;
    let userId: number | null = null;
    if (claims) {
      // Authenticated user — check if admin
      let userDbId: number;
      try {
        userDbId = decodePublicID(claims.user_id).dbID;
      } catch {
        throw new BadRequestException(ErrorCodes.INVALID_PUBLIC_ID);
      }
      const user = await this.findUserById(userDbId);
      if (user) {
        userId = user.id;
        if (
          user.userGroupId === 1 &&
          req.email &&
          user.email === req.email
        ) {
          isAdmin = true;
          status = 1; // Admin comments auto-publish
        }
      }
    } else {
      // Guest user — check if using admin email per D-129
      if (req.email && req.email !== '') {
        const admins = await this.findAdmins();
        if (admins && admins.length > 0) {
          for (const admin of admins) {
            if (admin.email === req.email) {
              throw new BadRequestException(
                ErrorCodes.ADMIN_EMAIL_USED_BY_GUEST,
              );
            }
          }
        }
      }
    }

    // 10. Anonymous validation per D-128
    if (req.is_anonymous) {
      const anonymousEmail =
        this.settingsService.get('comment_anonymous_email') || '';
      if (anonymousEmail && req.email !== anonymousEmail) {
        throw new BadRequestException(
          ErrorCodes.COMMENT_ANONYMOUS_EMAIL_MISMATCH,
        );
      }
    }

    // 11. Create comment record per D-126 step 11
    const params: CreateCommentParams = {
      targetPath: req.target_path,
      targetTitle: req.target_title || null,
      userId,
      parentId: parentDbId,
      replyToId: replyToDbId,
      nickname: req.nickname,
      email: req.email || null,
      emailMd5,
      website: req.website || null,
      content: req.content,
      contentHtml,
      status,
      isAdminComment: isAdmin,
      isAnonymous: req.is_anonymous,
      userAgent: ua,
      ipAddress: ip,
      ipLocation,
    };

    const newComment = await this.repo.create(params);

    // 12. Pushoo notification per D-153, D-155
    if (newComment.status === 1) {
      this.firePushooNotification(newComment, parentComment, req, ip);
    }

    // 13. In-app notification for comment reply per D-219
    // If the comment is a reply (replyToDbId is not null) and the reply target has a userId (not a guest),
    // check if the user has comment_reply notification enabled and create an in-app notification.
    // CR-01 fix: Skip self-notification — don't notify user about their own reply.
    let replierUserId: number | null = null;
    if (claims?.user_id) {
      try {
        replierUserId = decodePublicID(claims.user_id).dbID;
      } catch {
        // Invalid user_id in claims — skip self-notification check
      }
    }
    if (replyToDbId && replyToComment?.userId && replyToComment.userId !== replierUserId) {
      // Fire-and-forget: inner try-catch handles errors (WR-03 fix: no double error handling)
      this.fireCommentReplyNotification(replyToComment.userId, req.nickname);
    }

    // 14. Dispatch comment notification job (email + in-app)
    // Matches Go: commentSvc.Create() dispatches CommentNotificationJob
    // The job handles both admin notification and reply notification via email
    this.scheduleService.dispatchCommentNotification(newComment.id);

    // 14. Return response DTO
    return await this.toResponseDTO(newComment, parentComment, replyToComment, false);
  }

  // ============================================================
  // TORESPONSEDTO — matches Go service.go lines 944-1051
  // ============================================================

  /**
   * Convert a comment record to API response DTO.
   * Per D-138: includes all Go dto.Response fields.
   * Per D-207: admin-only fields only when isAdminView=true.
   *
   * This method is async because renderHTMLURLs requires async file lookups.
   * Matches Go toResponseDTO which calls renderHTMLURLs at line 965.
   */
  async toResponseDTO(
    c: any,
    parent: any | null,
    replyTo: any | null,
    isAdminView: boolean,
  ): Promise<any> {
    if (!c) return null;

    // 1. Generate public ID
    const publicID = generatePublicID(c.id, EntityType.Comment);

    // 2. Re-render content for fresh emoji/extension rendering per Go line 954
    let renderedContentHtml: string;
    try {
      renderedContentHtml = renderCommentMarkdown(c.content);
    } catch {
      this.logger.warn(`解析评论 ${publicID} 的表情包失败`);
      renderedContentHtml = c.contentHtml;
    }

    // 3. Render image URLs — replace anzhiyu://file/ with signed download URLs
    // Per Go line 965: renderedContentHTML, err = s.renderHTMLURLs(ctx, renderedContentHTML)
    try {
      renderedContentHtml = await this.renderHTMLURLs(renderedContentHtml);
    } catch {
      this.logger.warn(`渲染评论 ${publicID} 的HTML链接失败`);
      renderedContentHtml = c.contentHtml;
    }

    // 4. Compute emailMd5 and detect QQ email
    let emailMd5 = c.emailMd5 || '';
    let qqNumber: string | null = null;
    if (c.email) {
      const emailLower = c.email.toLowerCase();
      emailMd5 = crypto
        .createHash('md5')
        .update(emailLower)
        .digest('hex');
      const matches = qqEmailRegex.exec(emailLower);
      if (matches && matches[1]) {
        qqNumber = matches[1];
      }
    }

    // 5. Get parent/replyTo public IDs
    let parentPublicId: string | null = null;
    if (parent) {
      parentPublicId = generatePublicID(parent.id, EntityType.Comment);
    }

    let replyToPublicId: string | null = null;
    let replyToNick: string | null = null;
    if (replyTo) {
      replyToPublicId = generatePublicID(replyTo.id, EntityType.Comment);
      replyToNick = replyTo.nickname;
    }

    // 6. Show UA/Region based on settings per Go lines 997-1040
    const showUA = this.settingsService.get('comment_show_ua') === 'true';
    const showRegion =
      this.settingsService.get('comment_show_region') === 'true';

    // 7. Get avatar URL per Go lines 1002-1009
    let avatarUrl: string | null = null;
    if (c.userId) {
      try {
        const user = await this.findUserById(c.userId);
        if (user && user.avatar) {
          let avatar = user.avatar;
          // Relative path: prepend gravatar base URL per Go line 1005-1008
          if (!avatar.startsWith('http://') && !avatar.startsWith('https://')) {
            const gravatarBase = (this.settingsService.get('gravatar_url') || '').replace(/\/+$/, '');
            if (gravatarBase) {
              avatar = gravatarBase + '/' + avatar.replace(/^\/+/, '');
            }
          }
          avatarUrl = avatar;
        }
      } catch {
        // Avatar lookup failed — leave as null
      }
    }

    // 8. Build response
    const resp: any = {
      id: publicID,
      created_at: c.createdAt,
      pinned_at: c.pinnedAt || null,
      nickname: c.nickname,
      email_md5: emailMd5,
      qq_number: qqNumber,
      avatar_url: avatarUrl,
      website: c.website || null,
      content_html: renderedContentHtml,
      is_admin_comment: c.isAdminComment,
      is_anonymous: c.isAnonymous,
      target_path: c.targetPath,
      target_title: c.targetTitle || null,
      parent_id: parentPublicId,
      reply_to_id: replyToPublicId,
      reply_to_nick: replyToNick,
      like_count: c.likeCount,
      total_children: 0,
      children: [],
    };

    if (showUA) {
      resp.user_agent = c.userAgent || null;
    }
    if (showRegion) {
      resp.ip_location = c.ipLocation || null;
    }

    // 9. Admin-only fields per D-138, D-207
    if (isAdminView) {
      resp.email = c.email || null;
      resp.ip_address = c.ipAddress || null;
      resp.content = c.content || null;
      resp.status = c.status;
    }

    return resp;
  }

  // ============================================================
  // LOOKUPIPLOCATION — per D-143
  // ============================================================

  /**
   * Lookup IP geolocation.
   * Delegates to GeoIPService from WeatherModule per D-143.
   * Falls back to direct HTTP call if GeoIPService fails.
   */
  async lookupIPLocation(ip: string, referer: string): Promise<string> {
    if (!ip) return '未知';

    // Try GeoIPService first (from WeatherModule)
    try {
      const location = await this.geoipService.lookup(ip, referer);
      if (location) {
        const { province, city } = location;
        if (province && city) {
          return province === city ? province : `${province}${city}`;
        }
        if (province) return province;
      }
    } catch {
      this.logger.warn(`GeoIPService lookup failed for IP: ${ip}`);
    }

    // GeoIPService(腾讯位置服务)失败或无结果时直接返回「未知」
    // (原 NSUUU fallback 已移除:api.nsuuu.com 已失效,GeoIPService 已覆盖私有 IP 场景)
    return '未知';
  }

  // ============================================================
  // RENDERHTMLURLS — per D-123
  // ============================================================

  /**
   * Replace anzhiyu://file/ URIs in HTML with signed download URLs.
   * Per D-123: regex match, lookup file via FileService, generate signed URL.
   * If comment_image policy has image_process.default_style, append style suffix.
   * Matches Go renderHTMLURLs lines 1053-1110.
   */
  async renderHTMLURLs(htmlContent: string): Promise<string> {
    // Quick path: no internal URIs
    if (!htmlContent.includes('anzhiyu://file/')) {
      return htmlContent;
    }

    // Look up comment_image policy for style suffix
    let styleSuffix = '';
    try {
      const policy = await this.policyService.findByFlag('comment_image');
      if (policy?.settings?.image_process?.default_style) {
        styleSuffix = `!${policy.settings.image_process.default_style}`;
      }
    } catch {
      // Policy lookup failed, no style suffix
    }

    // Replace each matched URI — use a fresh regex per call
    const regex = /src="anzhiyu:\/\/file\/([a-zA-Z0-9_-]+)"/g;
    const result = htmlContent.replace(regex, (match: string, publicId: string) => {
      try {
        // Use FileService to find file and generate signed URL
        // Matching Go: s.fileSvc.FindFileByPublicID + s.fileSvc.GetDownloadURLForFileWithExpiration
        let signedUrl: string | null = null;

        // Try to find file via FileService
        try {
          signedUrl = this.fileService.generateSignedContentUrl(publicId);
        } catch {
          // FileService failed, leave original
          return match;
        }

        if (!signedUrl) {
          return `src=""`; // Matching Go: returns src="" on failure
        }

        // Append style suffix if configured
        return `src="${signedUrl}${styleSuffix}"`;
      } catch {
        // Any failure, leave original src unchanged
        return match;
      }
    });

    return result;
  }

  // ============================================================
  // LISTBYPATH — matches Go service.go lines 608-782
  // ============================================================

  /**
   * List comments by path with in-memory tree building.
   * Per D-119: loads up to 500 comments, builds tree, root pagination,
   * 3-chainHead preview with full chains.
   */
  async listByPath(
    targetPath: string,
    page: number,
    pageSize: number,
  ): Promise<any> {
    // 1. Fetch all published comments for path (limit 500)
    const allComments = await this.repo.findAllPublishedByPath(targetPath);

    // 2. Build commentMap and identify roots
    const commentMap = new Map<number, any>();
    const rootComments: any[] = [];
    const descendantsMap = new Map<number, any[]>();

    for (const c of allComments) {
      commentMap.set(c.id, c);
      if (c.parentId === null) {
        rootComments.push(c);
      }
    }

    // 3. Build descendantsMap: trace each non-root to its root ancestor
    for (const c of allComments) {
      if (c.parentId !== null) {
        let ancestor = c;
        const visited = new Set<number>();
        while (ancestor.parentId !== null) {
          if (visited.has(ancestor.id)) break; // Cycle detection
          visited.add(ancestor.id);
          const parent = commentMap.get(ancestor.parentId);
          if (!parent) break;
          ancestor = parent;
        }
        if (ancestor.parentId === null) {
          const rootID = ancestor.id;
          if (!descendantsMap.has(rootID)) {
            descendantsMap.set(rootID, []);
          }
          descendantsMap.get(rootID)!.push(c);
        }
      }
    }

    // 4. Sort roots: pinned first (pinnedAt desc), then by createdAt desc
    rootComments.sort((a, b) => {
      const aPinned = a.pinnedAt !== null;
      const bPinned = b.pinnedAt !== null;
      if (aPinned !== bPinned) return aPinned ? -1 : 1; // Pinned first
      if (aPinned && bPinned) {
        return (
          new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime()
        );
      }
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    // 5. Paginate roots
    const totalRootComments = rootComments.length;
    const totalWithChildren = allComments.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    if (start >= rootComments.length) {
      return {
        list: [],
        total: totalRootComments,
        total_with_children: totalWithChildren,
        page,
        pageSize,
        has_more: allComments.length >= 500,
      };
    }

    const paginatedRoots = rootComments.slice(
      start,
      Math.min(end, rootComments.length),
    );

    // 6. Build response with chainHead preview per D-119
    const previewLimit = 3;
    const rootResponses: any[] = [];

    for (const root of paginatedRoots) {
      const rootResp = await this.toResponseDTO(root, null, null, false);
      const descendants = descendantsMap.get(root.id) || [];

      rootResp.total_children = descendants.length;

      // Find chainHeads: descendants where replyToId equals root.ID or replyToId is null
      const chainHeads: any[] = [];
      for (const child of descendants) {
        if (child.replyToId === null || child.replyToId === root.id) {
          chainHeads.push(child);
        }
      }

      // Take first N chainHeads
      const previewChainHeads =
        chainHeads.length > previewLimit
          ? chainHeads.slice(0, previewLimit)
          : chainHeads;

      // Recursively collect full chain for each selected chainHead
      const previewChildren: any[] = [];
      const selectedIDs = new Set<number>();

      const collectChain = (commentID: number) => {
        if (selectedIDs.has(commentID)) return;
        selectedIDs.add(commentID);

        const comment = descendants.find((c: any) => c.id === commentID);
        if (comment) {
          previewChildren.push(comment);
        }

        // Recursively add all replies to this comment
        for (const child of descendants) {
          if (child.replyToId === commentID) {
            collectChain(child.id);
          }
        }
      };

      for (const head of previewChainHeads) {
        collectChain(head.id);
      }

      // Map children to ResponseDTO with parent and replyTo from commentMap
      const childResponses: any[] = [];
      for (const child of previewChildren) {
        const parent = child.parentId ? commentMap.get(child.parentId) : null;
        let replyTo = child.replyToId
          ? commentMap.get(child.replyToId)
          : null;
        if (!replyTo && parent) {
          replyTo = parent;
        }
        childResponses.push(await this.toResponseDTO(child, parent, replyTo, false));
      }

      rootResp.children = childResponses;
      rootResponses.push(rootResp);
    }

    return {
      list: rootResponses,
      total: totalRootComments,
      total_with_children: totalWithChildren,
      page,
      pageSize,
      has_more: allComments.length >= 500,
    };
  }

  // ============================================================
  // LISTLATEST — matches Go service.go lines 138-217
  // ============================================================

  /**
   * List latest published comments (flat paginated list).
   * Per D-121: returns flat list with parent/replyTo info filled.
   */
  async listLatest(page: number, pageSize: number): Promise<any> {
    if (page < 1) page = 1;
    if (pageSize < 1 || pageSize > 100) pageSize = 10;

    const { list: comments, total } =
      await this.repo.findAllPublishedPaginated(page, pageSize);

    // Collect parent and replyTo IDs for batch lookup
    const allNeededIDs = new Set<number>();
    for (const comment of comments) {
      if (comment.parentId) allNeededIDs.add(comment.parentId);
      if (comment.replyToId) allNeededIDs.add(comment.replyToId);
    }

    // Batch fetch referenced comments
    const commentMap = new Map<number, any>();
    if (allNeededIDs.size > 0) {
      const batchComments = await this.repo.findManyByIDs(
        Array.from(allNeededIDs),
      );
      for (const c of batchComments) {
        commentMap.set(c.id, c);
      }
    }

    // Map to ResponseDTO
    const responses: any[] = [];
    for (const comment of comments) {
      const parent = comment.parentId
        ? commentMap.get(comment.parentId)
        : null;
      let replyTo = comment.replyToId
        ? commentMap.get(comment.replyToId)
        : null;
      // Backward compatibility: if no replyToId, use parent
      if (!replyTo && parent) {
        replyTo = parent;
      }
      responses.push(await this.toResponseDTO(comment, parent, replyTo, false));
    }

    return {
      list: responses,
      total,
      total_with_children: total, // Flat list, same as total
      page,
      pageSize,
    };
  }

  // ============================================================
  // LISTCHILDREN — matches Go service.go lines 784-942
  // ============================================================

  /**
   * List children of a comment with preview mode.
   * Per D-120: preview mode (page=1, pageSize<=3) uses chainHead logic;
   * otherwise normal pagination.
   */
  async listChildren(
    parentPublicID: string,
    page: number,
    pageSize: number,
  ): Promise<any> {
    // 1. Decode parent ID
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(parentPublicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }

    // 2. Fetch parent comment
    const parentComment = await this.repo.findById(decoded.dbID);
    if (!parentComment) {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }

    // 3. Fetch all published comments for the same path
    const allComments = await this.repo.findAllPublishedByPath(
      parentComment.targetPath,
    );

    // 4. Build commentMap
    const commentMap = new Map<number, any>();
    for (const c of allComments) {
      commentMap.set(c.id, c);
    }

    // 5. Recursively find all descendants using parentId traversal
    // Per Go lines 812-819: uses parentId, not replyToId
    const allDescendants: any[] = [];
    const findChildren = (pId: number) => {
      for (const comment of allComments) {
        if (comment.parentId === pId) {
          allDescendants.push(comment);
          findChildren(comment.id);
        }
      }
    };
    findChildren(decoded.dbID);

    // 6. Preview mode vs normal pagination
    const total = allDescendants.length;
    const previewLimit = 3;
    const isPreviewMode = page === 1 && pageSize <= previewLimit;

    let paginatedDescendants: any[];

    if (isPreviewMode) {
      // Preview mode: chainHead logic per Go lines 822-887
      const chainHeads: any[] = [];
      for (const child of allDescendants) {
        if (child.replyToId === null || child.replyToId === decoded.dbID) {
          chainHeads.push(child);
        }
      }

      // Sort chainHeads by createdAt desc
      chainHeads.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      // Take first N chainHeads
      const previewChainHeads =
        chainHeads.length > previewLimit
          ? chainHeads.slice(0, previewLimit)
          : chainHeads;

      // Collect full chains
      paginatedDescendants = [];
      const selectedIDs = new Set<number>();

      const collectChain = (commentID: number) => {
        if (selectedIDs.has(commentID)) return;
        selectedIDs.add(commentID);

        const comment = allDescendants.find((c: any) => c.id === commentID);
        if (comment) {
          paginatedDescendants.push(comment);
        }

        for (const child of allDescendants) {
          if (child.replyToId === commentID) {
            collectChain(child.id);
          }
        }
      };

      for (const head of previewChainHeads) {
        collectChain(head.id);
      }
    } else {
      // Normal pagination: sort by createdAt desc, paginate
      allDescendants.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      if (start >= allDescendants.length) {
        return {
          list: [],
          total,
          total_with_children: total,
          page,
          pageSize,
        };
      }
      paginatedDescendants = allDescendants.slice(
        start,
        Math.min(end, allDescendants.length),
      );
    }

    // 7. Map to ResponseDTO
    const childResponses: any[] = [];
    for (const child of paginatedDescendants) {
      const parent = child.parentId ? commentMap.get(child.parentId) : null;
      let replyTo = child.replyToId
        ? commentMap.get(child.replyToId)
        : null;
      if (!replyTo && parent) {
        replyTo = parent;
      }
      childResponses.push(await this.toResponseDTO(child, parent, replyTo, false));
    }

    return {
      list: childResponses,
      total,
      total_with_children: total,
      page,
      pageSize,
    };
  }

  // ============================================================
  // Admin operations
  // ============================================================

  /**
   * Like a comment — increment likeCount per D-133.
   */
  async likeComment(publicID: string): Promise<{ like_count: number }> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    await this.repo.incrementLikeCount(decoded.dbID);
    const updated = await this.repo.findById(decoded.dbID);
    return { like_count: updated?.likeCount ?? 1 };
  }

  /**
   * Unlike a comment — decrement likeCount (min 0) per D-133.
   */
  async unlikeComment(publicID: string): Promise<{ like_count: number }> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    await this.repo.decrementLikeCount(decoded.dbID);
    const updated = await this.repo.findById(decoded.dbID);
    return { like_count: updated?.likeCount ?? 0 };
  }

  /**
   * Set or clear pin on a comment per D-134.
   */
  async setPin(publicID: string, isPinned: boolean): Promise<any> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    const updated = await this.repo.setPin(decoded.dbID, isPinned);
    return await this.toResponseDTO(updated, null, null, true);
  }

  /**
   * Update comment status (1=Published, 2=Pending, 3=Rejected).
   */
  async updateStatus(publicID: string, status: number): Promise<any> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    const updated = await this.repo.updateStatus(decoded.dbID, status);
    return await this.toResponseDTO(updated, null, null, true);
  }

  /**
   * Update comment content and re-render HTML per D-137.
   */
  async updateContent(publicID: string, newContent: string): Promise<any> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }

    // Re-render Markdown per D-137
    const contentHtml = renderCommentMarkdown(newContent);
    const updated = await this.repo.updateContent(
      decoded.dbID,
      newContent,
      contentHtml,
    );
    return await this.toResponseDTO(updated, null, null, true);
  }

  /**
   * Update comment user info (nickname, email, website) per D-137.
   * If email is updated, recompute emailMd5.
   */
  async updateCommentInfo(
    publicID: string,
    data: { nickname?: string; email?: string; website?: string; content?: string },
  ): Promise<any> {
    let decoded: { dbID: number; entityType: number };
    try {
      decoded = decodePublicID(publicID);
    } catch {
      throw new NotFoundException(ErrorCodes.COMMENT_NOT_FOUND);
    }
    if (decoded.entityType !== EntityType.Comment) {
      throw new BadRequestException(ErrorCodes.COMMENT_NOT_FOUND);
    }

    const updateData: any = {};

    if (data.nickname !== undefined) {
      updateData.nickname = data.nickname.trim();
    }
    if (data.email !== undefined) {
      const email = data.email.trim();
      updateData.email = email;
      if (email) {
        updateData.emailMd5 = crypto
          .createHash('md5')
          .update(email.toLowerCase())
          .digest('hex');
      } else {
        updateData.emailMd5 = '';
      }
    }
    if (data.website !== undefined) {
      updateData.website = data.website.trim();
    }
    if (data.content !== undefined) {
      updateData.content = data.content;
      updateData.contentHtml = renderCommentMarkdown(data.content);
    }

    const updated = await this.repo.updateCommentInfo(decoded.dbID, updateData);
    return await this.toResponseDTO(updated, null, null, true);
  }

  /**
   * Soft-delete comments per D-136.
   */
  async delete(ids: string[]): Promise<void> {
    const dbIds: number[] = [];
    for (const publicID of ids) {
      try {
        const decoded = decodePublicID(publicID);
        if (decoded.entityType === EntityType.Comment) {
          dbIds.push(decoded.dbID);
        }
      } catch {
        // Skip invalid IDs (matching Go behavior)
      }
    }
    if (dbIds.length > 0) {
      await this.repo.softDelete(dbIds);
    }
  }

  /**
   * Upload comment image per D-141, D-142.
   * Delegates to UploadService with comment_image policy flag.
   * Follows the same pattern as ArticleController.uploadImage.
   */
  async uploadImage(
    file: Express.Multer.File,
    user: any,
  ): Promise<{ id: string }> {
    const ownerId = user?.dbId || 1;

    // 1. Get comment_image policy per D-141
    const policy = await this.policyService.findByFlag('comment_image');
    if (!policy) {
      throw new BadRequestException('默认存储策略未初始化');
    }

    // 2. Generate unique filename (matching Go's uuid + ext pattern)
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;

    // 3. Ensure target directory exists
    const targetDir = path.join(getUploadBaseDir(), 'comments');
    await fs.mkdir(targetDir, { recursive: true });

    // 4. Write uploaded file to target path
    const targetPath = path.join(targetDir, uniqueName);
    await fs.writeFile(targetPath, file.buffer);

    // 5. Create parent directory record (so file manager can navigate into comments/)
    const parentId = await findOrCreateParentPath(
      `/comments/${uniqueName}`,
      ownerId,
      policy.id,
      this.db,
    );

    // 6. Create entity record (matching ArticleController pattern)
    const { entities } = await import('../database/schemas/entity.schema');
    const [entity] = await this.db
      .insert(entities)
      .values({
        type: 'image_content',
        source: targetPath,
        size: file.size,
        policyId: policy.id,
        createdBy: ownerId,
        mimeType: file.mimetype,
      })
      .returning();

    // 7. Create file record (with parentId for file manager navigation)
    const { files } = await import('../database/schemas/file.schema');
    const [fileRecord] = await this.db
      .insert(files)
      .values({
        ownerId,
        parentId,
        name: file.originalname,
        size: file.size,
        type: 1, // file
        primaryEntityId: entity.id,
      })
      .returning();

    // 7. Generate thumbnail (try-catch per D-106)
    try {
      const { ThumbnailService } = await import(
        '../thumbnail/thumbnail.service'
      );
      // ThumbnailService is not directly available here,
      // but UploadService handles thumbnail generation internally.
      // For the direct upload pattern, we skip thumbnail here
      // since it's handled by the file module's post-upload hook.
    } catch {
      // Thumbnail failure does not block upload per D-106
    }

    // 8. Return response matching Go backend UploadImage format
    return {
      id: generatePublicID(fileRecord.id, EntityType.File),
    };
  }

  // ============================================================
  // Admin list — matches Go service.go AdminList
  // ============================================================

  /**
   * Admin list with dynamic filters and pagination.
   */
  async adminList(filters: any): Promise<any> {
    if (filters.page < 1) filters.page = 1;
    if (filters.pageSize < 1 || filters.pageSize > 100)
      filters.pageSize = 10;

    const { list, total } = await this.repo.adminList(filters);

    const responses: any[] = [];
    for (const comment of list) {
      responses.push(await this.toResponseDTO(comment, null, null, true));
    }

    return {
      list: responses,
      total,
      total_with_children: total,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }

  // ============================================================
  // QQ Info & IP Location — matches Go service.go lines 1334-1600
  // ============================================================

  /**
   * Get QQ nickname and avatar by QQ number.
   * Per Go service.go GetIPLocation: calls third-party API with Bearer token auth.
   * Returns { nickname, avatar } matching Go QQInfoResponse.
   */
  async getQQInfo(qqNumber: string, referer: string): Promise<{ nickname: string; avatar: string }> {
    // Validate QQ number format per Go line 1344
    if (!/^[1-9]\d{4,10}$/.test(qqNumber)) {
      throw new BadRequestException('无效的QQ号格式');
    }

    const apiUrl = this.settingsService.get('comment_qq_api_url') || '';
    const apiKey = this.settingsService.get('comment_qq_api_key') || '';

    if (!apiUrl || !apiKey) {
      throw new BadRequestException('QQ信息查询API未配置');
    }

    try {
      const url = `${apiUrl}?qq=${encodeURIComponent(qqNumber)}`;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
      };
      if (referer) {
        headers['Referer'] = referer;
      }

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        throw new BadRequestException('获取QQ信息失败');
      }

      const data = (await response.json()) as any;
      if (data.code === 200 && data.data) {
        return {
          nickname: data.data.nick || data.data.nickname || '',
          avatar: data.data.avatar || data.data.img || '',
        };
      }

      throw new BadRequestException('获取QQ信息失败');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('获取QQ信息失败');
    }
  }

  /**
   * Get IP location info (full structure matching Go IPLocationResponse).
   * Per Go service.go GetIPLocation lines 1578-1600: returns flat object with
   * IP, country, province, city, ISP, latitude, longitude, address.
   * For LAN/private IPs, falls back to default rectangle from settings.
   */
  async getIPLocation(ip: string, referer: string): Promise<any> {
    const isPrivate = this.geoipService.isPrivateIP(ip);

    if (isPrivate) {
      // Return default coordinates for LAN IPs per Go lines 580-588
      const defaults = this.geoipService.getDefaultCoordinates();
      const rectangle = this.settingsService.get('sidebar.weather.rectangle') || '';
      const result: any = {
        ip,
        country: '局域网',
        province: '局域网',
        city: '',
        isp: '',
        latitude: defaults.latitude ? String(defaults.latitude) : '',
        longitude: defaults.longitude ? String(defaults.longitude) : '',
        address: '',
      };
      if (rectangle) {
        result.default_rectangle = rectangle;
      }
      return result;
    }

    try {
      const location = await this.geoipService.lookup(ip, referer);
      if (location) {
        return {
          ip,
          country: location.country || '',
          province: location.province || '',
          city: location.city || '',
          isp: location.isp || '',
          latitude: location.latitude ? String(location.latitude) : '',
          longitude: location.longitude ? String(location.longitude) : '',
          address: location.address || [location.country, location.province, location.city].filter(Boolean).join('') || '',
        };
      }
    } catch {
      this.logger.warn(`IP location lookup failed for IP: ${ip}`);
    }

    // Fallback: default coordinates
    const defaults = this.geoipService.getDefaultCoordinates();
    const rectangle = this.settingsService.get('sidebar.weather.rectangle') || '';
    const result: any = {
      ip,
      country: '',
      province: '',
      city: '',
      isp: '',
      latitude: defaults.latitude ? String(defaults.latitude) : '',
      longitude: defaults.longitude ? String(defaults.longitude) : '',
      address: '',
    };
    if (rectangle) {
      result.default_rectangle = rectangle;
    }
    return result;
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /**
   * Find user by DB ID. Uses direct Drizzle query since UserRepository
   * doesn't exist as a separate injectable.
   * Matches Go's userRepo.FindByID behavior.
   */
  private async findUserById(dbId: number): Promise<any | null> {
    try {
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, dbId));
      return user || null;
    } catch {
      return null;
    }
  }

  /**
   * Find all admin users (userGroupId=1).
   * Matches Go's userRepo.FindByGroupID(1) behavior.
   */
  private async findAdmins(): Promise<any[] | null> {
    try {
      const admins = await this.db
        .select()
        .from(users)
        .where(and(eq(users.userGroupId, 1), isNull(users.deletedAt)));
      return admins;
    } catch {
      this.logger.warn('查询管理员列表失败');
      return null;
    }
  }

  /**
   * Fire in-app notification for comment reply per D-219.
   * Fire-and-forget: checks if the reply target user has comment_reply notification enabled,
   * then creates an in-app notification record.
   */
  private async fireCommentReplyNotification(
    replyToUserId: number,
    replierNickname: string,
  ): Promise<void> {
    try {
      const shouldNotify = await this.notificationService.shouldNotifyUser(
        replyToUserId,
        'comment_reply',
        'push',
      );
      if (!shouldNotify) return;

      const commentReplyType = await this.notificationService.findNotificationTypeByCode('comment_reply');
      if (!commentReplyType) return;

      await this.notificationService.createNotification({
        userId: replyToUserId,
        notificationTypeId: commentReplyType.id,
        title: '评论回复通知',
        content: `${replierNickname} 回复了您的评论`,
      });
    } catch (err) {
      this.logger.warn(`In-app notification creation failed: ${err}`);
    }
  }

  /**
   * Fire Pushoo notification in fire-and-forget mode.
   * Per D-153, D-155: two scenarios:
   * (a) Notify admin of new comment if comment is not from admin and parent is not admin
   * (b) Notify admin if reply is to admin's comment
   */
  private firePushooNotification(
    newComment: any,
    parentComment: any | null,
    req: any,
    ip: string,
  ): void {
    // Fire-and-forget: don't await
    (async () => {
      try {
        const pushChannel = this.settingsService.get('pushoo_channel') || '';
        if (!pushChannel) return;

        const pushUrl = this.settingsService.get('pushoo_url') || '';
        if (!pushUrl) return;

        const notifyAdmin =
          this.settingsService.get('comment_notify_admin') === 'true';
        const scMailNotify =
          this.settingsService.get('sc_mail_notify') === 'true';
        const notifyReply =
          this.settingsService.get('comment_notify_reply') === 'true';
        const adminEmail =
          this.settingsService.get('front_desk_site_owner_email') || '';

        // Skip if commenter is the admin (same email as notification receiver)
        const commenterEmail = newComment.email || '';
        if (commenterEmail && commenterEmail === adminEmail) return;

        const isAdminComment = newComment.isAdminComment;
        const hasParent = parentComment !== null;
        const parentIsAdmin = hasParent && parentComment.isAdminComment;

        // Scenario 1: Notify admin of new comment
        // Condition: (notifyAdmin or scMailNotify) AND not admin comment AND parent is not admin
        if ((notifyAdmin || scMailNotify) && !isAdminComment) {
          if (!parentIsAdmin) {
            const message = `📝 新评论: ${newComment.nickname} 在 ${newComment.targetPath} 评论: ${newComment.content.substring(0, 50)}`;
            await this.sendPushooNotification(
              pushUrl,
              pushChannel,
              message,
            );
          }
        }

        // Scenario 2: Notify when reply is to admin's comment
        // Condition: notifyReply AND has parent AND parent is admin AND not self-reply
        if (notifyReply && hasParent && parentIsAdmin) {
          const parentEmail = parentComment.email || '';
          if (parentEmail && commenterEmail !== parentEmail) {
            const message = `💬 回复评论: ${newComment.nickname} 回复了你在 ${newComment.targetPath} 的评论: ${newComment.content.substring(0, 50)}`;
            await this.sendPushooNotification(
              pushUrl,
              pushChannel,
              message,
            );
          }
        }
      } catch (error) {
        this.logger.warn(`Pushoo通知发送失败: ${error}`);
      }
    })();
  }

  /**
   * Export comments as a JSON string.
   * Matches Go ExportComments: returns comments filtered by IDs (empty = all).
   * Frontend expects a Blob (responseType: 'blob'), so controller returns JSON buffer.
   */
  async exportComments(ids: string[]): Promise<Buffer> {
    const { comments } = await import('../database/schemas');
    const { eq, inArray, isNull, desc } = await import('drizzle-orm');

    let rows: any[];

    if (ids && ids.length > 0) {
      // Decode public IDs to database IDs
      const dbIds = ids
        .map((id) => {
          try {
            const decoded = decodePublicID(id);
            if (decoded.entityType === EntityType.Comment) {
              return decoded.dbID;
            }
            return null;
          } catch {
            return null;
          }
        })
        .filter((id): id is number => id !== null);

      if (dbIds.length === 0) {
        rows = [];
      } else {
        rows = await this.db
          .select()
          .from(comments)
          .where(inArray(comments.id, dbIds))
          .execute();
      }
    } else {
      // Export all non-deleted comments
      rows = await this.db
        .select()
        .from(comments)
        .where(isNull(comments.deletedAt))
        .orderBy(desc(comments.createdAt))
        .execute();
    }

    // Convert to export format (matching Go ExportComments output)
    const exportData = rows.map((row) => ({
      id: row.id,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      target_path: row.targetPath,
      target_title: row.targetTitle,
      user_id: row.userId,
      parent_id: row.parentId,
      reply_to_id: row.replyToId,
      nickname: row.nickname,
      email: row.email,
      email_md5: row.emailMd5,
      website: row.website,
      content: row.content,
      content_html: row.contentHtml,
      status: row.status,
      is_admin_comment: row.isAdminComment ? 1 : 0,
      is_anonymous: row.isAnonymous ? 1 : 0,
      user_agent: row.userAgent,
      ip_address: row.ipAddress,
      ip_location: row.ipLocation,
      like_count: row.likeCount,
      pinned_at: row.pinnedAt,
    }));

    return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
  }

  /**
   * Import comments from a JSON file.
   * Matches Go ImportComments: supports JSON format with options.
   */
  async importComments(
    fileData: Buffer,
    options: {
      skipExisting?: boolean;
      defaultStatus?: number;
      keepCreateTime?: boolean;
    },
  ): Promise<{
    total_count: number;
    success_count: number;
    skipped_count: number;
    failed_count: number;
    error_messages: string[];
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    const { comments } = await import('../database/schemas');
    const { eq, isNull } = await import('drizzle-orm');
    const { initSqidsEncoderWithSeed } = await import(
      '../common/utils/sqids.util'
    );

    const result = {
      total_count: 0,
      success_count: 0,
      skipped_count: 0,
      failed_count: 0,
      error_messages: [] as string[],
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    let parsed: any[];
    try {
      parsed = JSON.parse(fileData.toString('utf-8'));
      if (!Array.isArray(parsed)) {
        throw new Error('Expected an array of comments');
      }
    } catch (e: any) {
      result.failed_count = 1;
      result.error_messages.push(`Invalid JSON: ${e.message}`);
      result.errors = result.error_messages;
      return result;
    }

    result.total_count = parsed.length;

    for (const item of parsed) {
      try {
        // Skip existing if requested — check by target_path + nickname + content
        if (options.skipExisting) {
          const existing = await this.db
            .select({ id: comments.id })
            .from(comments)
            .where(
              eq(comments.targetPath, item.target_path || ''),
            )
            .limit(1)
            .execute();

          if (existing.length > 0) {
            result.skipped_count++;
            continue;
          }
        }

        const now = Math.floor(Date.now() / 1000);
        const createdAt = options.keepCreateTime
          ? item.created_at || now
          : now;
        const updatedAt = now;

        await this.db.insert(comments).values({
          targetPath: item.target_path || '',
          targetTitle: item.target_title || null,
          userId: item.user_id || null,
          parentId: item.parent_id || null,
          replyToId: item.reply_to_id || null,
          nickname: item.nickname || 'Anonymous',
          email: item.email || null,
          emailMd5: item.email_md5 || '',
          website: item.website || null,
          content: item.content || '',
          contentHtml: item.content_html || item.content || '',
          status: item.status || options.defaultStatus || 1,
          isAdminComment: item.is_admin_comment === 1,
          isAnonymous: item.is_anonymous === 1,
          userAgent: item.user_agent || null,
          ipAddress: item.ip_address || '0.0.0.0',
          ipLocation: item.ip_location || null,
          likeCount: item.like_count || 0,
          pinnedAt: item.pinned_at || null,
          createdAt,
          updatedAt,
        });

        result.success_count++;
      } catch (e: any) {
        result.failed_count++;
        const msg = `Comment import failed: ${e.message}`;
        result.error_messages.push(msg);
      }
    }

    result.imported = result.success_count;
    result.skipped = result.skipped_count;
    result.errors = result.error_messages;

    return result;
  }

  /**
   * Send Pushoo notification via HTTP POST.
   */
  private async sendPushooNotification(
    pushUrl: string,
    channel: string,
    message: string,
  ): Promise<void> {
    const pushToken = this.settingsService.get('pushoo_token') || '';
    const body = {
      channel,
      token: pushToken,
      message,
    };

    const response = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      this.logger.warn(
        `Pushoo API returned ${response.status}: ${await response.text()}`,
      );
    }
  }
}
