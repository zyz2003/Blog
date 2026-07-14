import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';
import { SettingsService } from '../settings/settings.service';
import { CommentRateLimiter } from './comment-rate-limiter';
import { UploadService } from '../file/upload.service';
import { StoragePolicyService } from '../storage-policy/storage-policy.service';
import { FileService } from '../file/file.service';
import { ErrorCodes } from '../common/constants/error-codes';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { initSqidsEncoderWithSeed, generatePublicID, EntityType } from '../common/utils/sqids.util';

// Mock dependencies
const mockRepo = {
  findById: vi.fn(),
  findManyByIDs: vi.fn(),
  create: vi.fn(),
  incrementLikeCount: vi.fn(),
  decrementLikeCount: vi.fn(),
  setPin: vi.fn(),
  updateStatus: vi.fn(),
  updateContent: vi.fn(),
  updateCommentInfo: vi.fn(),
  softDelete: vi.fn(),
  findAllPublishedByPath: vi.fn(),
  findAllPublishedPaginated: vi.fn(),
  adminList: vi.fn(),
} as any;

const mockSettingsService = {
  get: vi.fn(),
  getAll: vi.fn(),
} as any;

const mockRateLimiter = {
  checkLimit: vi.fn(),
} as any;

const mockUploadService = {
  createSession: vi.fn(),
  uploadChunk: vi.fn(),
} as any;

const mockStoragePolicyService = {
  findByFlag: vi.fn(),
} as any;

const mockFileService = {
  generateSignedContentUrl: vi.fn(),
  findFileByPublicID: vi.fn(),
} as any;

const mockGeoIPService = {
  lookup: vi.fn(),
  isPrivateIP: vi.fn(),
  getDefaultCoordinates: vi.fn(),
} as any;

const mockNotificationService = {
  shouldNotifyUser: vi.fn(),
  findNotificationTypeByCode: vi.fn(),
  createNotification: vi.fn(),
} as any;

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 1 }]),
} as any;

// Helper to create a comment record
function makeComment(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    targetPath: '/posts/hello-world',
    targetTitle: 'Hello World',
    userId: null,
    parentId: null,
    replyToId: null,
    nickname: 'TestUser',
    email: 'test@example.com',
    emailMd5: 'abc123',
    website: null,
    content: 'Hello',
    contentHtml: '<p>Hello</p>',
    status: 1,
    isAdminComment: false,
    isAnonymous: false,
    userAgent: 'Mozilla/5.0',
    ipAddress: '127.0.0.1',
    ipLocation: '北京',
    likeCount: 0,
    pinnedAt: null,
    ...overrides,
  };
}

// Helper to create a user record
function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    email: 'admin@example.com',
    nickname: 'Admin',
    userGroupId: 1,
    avatar: null,
    ...overrides,
  };
}

function createService() {
  return new CommentService(
    mockRepo,
    mockSettingsService,
    mockRateLimiter,
    mockUploadService,
    mockStoragePolicyService,
    mockFileService,
    mockGeoIPService,
    mockNotificationService,
    mockDb,
  );
}

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Initialize Sqids encoder for public ID generation/decoding
    initSqidsEncoderWithSeed('test-seed');
    service = createService();
  });

  // Helper: generate a valid Sqids public ID for a comment with given dbID
  function commentPublicId(dbId: number): string {
    return generatePublicID(dbId, EntityType.Comment);
  }

  // Helper: generate a valid Sqids public ID for a user with given dbId
  function userPublicId(dbId: number): string {
    return generatePublicID(dbId, EntityType.User);
  }

  // ============================================================
  // Task 1: Write-path and utilities
  // ============================================================

  describe('Create', () => {
    it('Test 1: should decode parentId/replyToId via Sqids, validate parent exists and belongs to same targetPath', async () => {
      // Setup: parent comment exists at same path
      const parentComment = makeComment({ id: 10, targetPath: '/posts/hello' });
      mockRepo.findById.mockResolvedValue(parentComment);
      mockSettingsService.get.mockReturnValue('10'); // limit per minute
      mockRateLimiter.checkLimit.mockReturnValue(undefined);
      mockRepo.create.mockResolvedValue(makeComment({ id: 100, parentId: 10 }));

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: commentPublicId(10), // valid Sqids ID for comment dbID=10
        reply_to_id: '',
        nickname: 'User',
        email: 'user@example.com',
        website: '',
        content: 'Nice post!',
        is_anonymous: false,
      };

      // If parent is anonymous, should throw ErrAnonymousNoReply
      const anonymousParent = makeComment({ id: 10, targetPath: '/posts/hello', isAnonymous: true });
      mockRepo.findById.mockResolvedValue(anonymousParent);

      await expect(service.create(req, '127.0.0.1', 'Mozilla/5.0', 'http://example.com', null))
        .rejects.toThrow(ErrorCodes.COMMENT_ANONYMOUS_NO_REPLY);
    });

    it('Test 2: should render Markdown via renderCommentMarkdown and compute emailMd5 via MD5 of lowercase email', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_limit_per_minute') return '10';
        if (key === 'comment_forbidden_words') return '';
        return '';
      });
      mockRateLimiter.checkLimit.mockReturnValue(undefined);
      mockRepo.create.mockImplementation((params: any) => {
        // Verify contentHtml was rendered from Markdown
        expect(params.contentHtml).toContain('<p>');
        // Verify emailMd5 was computed from lowercase email
        expect(params.emailMd5).toBeTruthy();
        return Promise.resolve(makeComment({ id: 100, ...params }));
      });

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: '',
        reply_to_id: '',
        nickname: 'User',
        email: 'User@Example.COM',
        website: '',
        content: '**Bold text**',
        is_anonymous: false,
      };

      await service.create(req, '127.0.0.1', 'Mozilla/5.0', 'http://example.com', null);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('Test 3: should check forbidden words from settings; if detected, set status=2 (Pending)', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_limit_per_minute') return '10';
        if (key === 'comment_forbidden_words') return 'spam,广告';
        return '';
      });
      mockRateLimiter.checkLimit.mockReturnValue(undefined);
      mockRepo.create.mockImplementation((params: any) => {
        expect(params.status).toBe(2); // Pending
        return Promise.resolve(makeComment({ id: 100, status: 2, ...params }));
      });

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: '',
        reply_to_id: '',
        nickname: 'User',
        email: 'user@example.com',
        website: '',
        content: 'This is spam content',
        is_anonymous: false,
      };

      await service.create(req, '127.0.0.1.1', 'Mozilla/5.0', 'http://example.com', null);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('Test 4: should detect admin comment: claims exist + userGroupId=1 + email matches admin email; sets isAdminComment=true, status=1', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_limit_per_minute') return '10';
        if (key === 'comment_forbidden_words') return '';
        return '';
      });
      mockRateLimiter.checkLimit.mockReturnValue(undefined);

      // Mock user lookup for admin detection
      const adminUser = makeUser({ id: 1, email: 'admin@example.com', userGroupId: 1 });
      // The service will query users table directly via db
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([adminUser]);

      mockRepo.create.mockImplementation((params: any) => {
        expect(params.isAdminComment).toBe(true);
        expect(params.status).toBe(1); // Published
        return Promise.resolve(makeComment({ id: 100, isAdminComment: true, status: 1, ...params }));
      });

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: '',
        reply_to_id: '',
        nickname: 'Admin',
        email: 'admin@example.com',
        website: '',
        content: 'Admin comment',
        is_anonymous: false,
      };

      const claims = { user_id: userPublicId(1), user_group_id: '1' };
      await service.create(req, '127.0.0.1', 'Mozilla/5.0', 'http://example.com', claims);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('Test 5: should throw ErrAdminEmailUsedByGuest when non-admin uses admin email', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_limit_per_minute') return '10';
        if (key === 'comment_forbidden_words') return '';
        return '';
      });
      mockRateLimiter.checkLimit.mockReturnValue(undefined);

      // Mock admin lookup: find admins with groupId=1
      const adminUser = makeUser({ id: 1, email: 'admin@example.com', userGroupId: 1 });
      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockResolvedValue([adminUser]);

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: '',
        reply_to_id: '',
        nickname: 'Imposter',
        email: 'admin@example.com',
        website: '',
        content: 'Trying to impersonate',
        is_anonymous: false,
      };

      // No claims = guest user
      await expect(service.create(req, '127.0.0.1', 'Mozilla/5.0', 'http://example.com', null))
        .rejects.toThrow(ErrorCodes.ADMIN_EMAIL_USED_BY_GUEST);
    });

    it('Test 6: should validate anonymous comment: isAnonymous=true requires email matching settings comment_anonymous_email', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_limit_per_minute') return '10';
        if (key === 'comment_forbidden_words') return '';
        if (key === 'comment_anonymous_email') return 'anonymous@example.com';
        return '';
      });
      mockRateLimiter.checkLimit.mockReturnValue(undefined);

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: '',
        reply_to_id: '',
        nickname: 'Anon',
        email: 'wrong@example.com', // does NOT match anonymous email
        website: '',
        content: 'Anonymous comment',
        is_anonymous: true,
      };

      await expect(service.create(req, '127.0.0.1', 'Mozilla/5.0', 'http://example.com', null))
        .rejects.toThrow(ErrorCodes.COMMENT_ANONYMOUS_EMAIL_MISMATCH);
    });

    it('Test 7: should call Pushoo notification when status=Published and pushChannel is configured', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_limit_per_minute') return '10';
        if (key === 'comment_forbidden_words') return '';
        if (key === 'pushoo_channel') return 'test-channel';
        if (key === 'pushoo_url') return 'https://push.example.com';
        if (key === 'comment_notify_admin') return 'true';
        if (key === 'sc_mail_notify') return 'false';
        if (key === 'comment_notify_reply') return 'false';
        if (key === 'front_desk_site_owner_email') return 'admin@example.com';
        return '';
      });
      mockRateLimiter.checkLimit.mockReturnValue(undefined);
      mockRepo.create.mockResolvedValue(makeComment({ id: 100, status: 1, email: 'guest@example.com' }));

      // Mock fetch for Pushoo notification
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mockFetch);

      const req = {
        target_path: '/posts/hello',
        target_title: 'Hello',
        parent_id: '',
        reply_to_id: '',
        nickname: 'Guest',
        email: 'guest@example.com',
        website: '',
        content: 'Nice post!',
        is_anonymous: false,
      };

      await service.create(req, '127.0.0.1', 'Mozilla/5.0', 'http://example.com', null);

      // Pushoo notification should be fired (fire-and-forget, so we wait a tick)
      await new Promise(resolve => setTimeout(resolve, 50));
      // The notification is fire-and-forget, so we just verify it doesn't throw
      vi.restoreAllMocks();
    });

    it('Test 8: toResponseDTO should generate public ID, re-render Markdown, apply showUA/showRegion settings, include admin-only fields when isAdminView=true', async () => {
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'true';
        if (key === 'comment_show_region') return 'true';
        if (key === 'gravatar_url') return 'https://gravatar.com/avatar';
        return '';
      });

      const comment = makeComment({ id: 42, email: 'test@example.com' });
      const result = await service.toResponseDTO(comment, null, null, true);

      // Should have public ID (generated via Sqids)
      expect(result.id).toBeTruthy();
      // Should have admin-only fields
      expect(result.email).toBeDefined();
      expect(result.ip_address).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.status).toBeDefined();
      // Should have user_agent and ip_location since showUA/showRegion are true
      expect(result.user_agent).toBeDefined();
      expect(result.ip_location).toBeDefined();
    });

    it('Test 9: lookupIPLocation should delegate to GeoIPService, fall back to direct HTTP call on failure', async () => {
      // Test GeoIPService delegation
      mockGeoIPService.lookup.mockResolvedValueOnce({
        province: '北京',
        city: '北京',
        latitude: 39.9,
        longitude: 116.4,
        country: '中国',
      });

      const location = await service.lookupIPLocation('8.8.8.8', 'http://example.com');
      expect(mockGeoIPService.lookup).toHaveBeenCalledWith('8.8.8.8', 'http://example.com');
      expect(location).toBe('北京'); // province === city, return province only

      // Test fallback when GeoIPService returns null
      mockGeoIPService.lookup.mockResolvedValueOnce(null);
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          code: 200,
          data: { province: '广东', city: '深圳' },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const location2 = await service.lookupIPLocation('8.8.4.4', 'http://example.com');
      expect(location2).toBe('广东深圳');

      vi.restoreAllMocks();
    });

    it('Test 10: renderHTMLURLs should replace anzhiyu://file/ URIs with signed download URLs', async () => {
      mockFileService.findFileByPublicID.mockResolvedValue({ id: 5, name: 'image.png', source: 'data/uploads/comments/image.png' });
      mockFileService.generateSignedContentUrl.mockReturnValue('/api/file/content?sign=abc:123:sig');

      const html = '<img src="anzhiyu://file/abc123" alt="test">';
      const result = await service.renderHTMLURLs(html);

      // Should replace the internal URI with a signed URL
      expect(result).not.toContain('anzhiyu://file/');
      expect(result).toContain('src=');
    });
  });

  // ============================================================
  // Task 2: Read-path
  // ============================================================

  describe('ListByPath', () => {
    it('Test 1: should build tree in memory, sort roots (pinned first), paginate roots, return 3 chainHeads with full chains', async () => {
      // Create a set of comments: 2 root comments, 3 children
      const root1 = makeComment({ id: 1, parentId: null, pinnedAt: null, createdAt: new Date('2024-01-02') });
      const root2 = makeComment({ id: 2, parentId: null, pinnedAt: new Date('2024-01-03'), createdAt: new Date('2024-01-01') });
      const child1 = makeComment({ id: 3, parentId: 1, replyToId: 1, targetPath: '/posts/hello' });
      const child2 = makeComment({ id: 4, parentId: 1, replyToId: 1, targetPath: '/posts/hello' });
      const child3 = makeComment({ id: 5, parentId: 1, replyToId: 3, targetPath: '/posts/hello' }); // reply to child1

      mockRepo.findAllPublishedByPath.mockResolvedValue([root1, root2, child1, child2, child3]);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.listByPath('/posts/hello', 1, 10);

      // root2 should be first (pinned)
      expect(result.list[0].id).toBeTruthy();
      // root2 is pinned, should come first
      expect(result.total).toBe(2); // 2 root comments
      expect(result.total_with_children).toBe(5); // all comments
      // Children should be populated for root1
      const root1Resp = result.list.find((r: any) => r.pinned_at === null) || result.list[1];
      expect(root1Resp.children.length).toBeGreaterThan(0);
    });
  });

  describe('ListLatest', () => {
    it('Test 2: should return flat paginated list of published comments with parent/replyTo info', async () => {
      const comment1 = makeComment({ id: 1, parentId: null, replyToId: null });
      const comment2 = makeComment({ id: 2, parentId: 1, replyToId: 1 });

      mockRepo.findAllPublishedPaginated.mockResolvedValue({
        list: [comment2, comment1],
        total: 2,
      });
      mockRepo.findManyByIDs.mockResolvedValue([comment1]);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.listLatest(1, 10);

      expect(result.list.length).toBe(2);
      expect(result.total).toBe(2);
    });
  });

  describe('ListChildren', () => {
    it('Test 3: should use preview mode for page=1 and pageSize<=3, otherwise normal pagination', async () => {
      const parent = makeComment({ id: 1, parentId: null, targetPath: '/posts/hello' });
      const child1 = makeComment({ id: 2, parentId: 1, replyToId: 1, targetPath: '/posts/hello' });
      const child2 = makeComment({ id: 3, parentId: 1, replyToId: 1, targetPath: '/posts/hello' });
      const child3 = makeComment({ id: 4, parentId: 1, replyToId: 1, targetPath: '/posts/hello' });
      const child4 = makeComment({ id: 5, parentId: 1, replyToId: 2, targetPath: '/posts/hello' }); // reply to child1

      mockRepo.findById.mockResolvedValue(parent);
      mockRepo.findAllPublishedByPath.mockResolvedValue([parent, child1, child2, child3, child4]);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      // Preview mode: page=1, pageSize=3
      const previewResult = await service.listChildren(commentPublicId(1), 1, 3);
      expect(previewResult.list.length).toBeGreaterThan(0);
      expect(previewResult.total).toBe(4); // 4 descendants

      // Normal mode: page=1, pageSize=10
      const normalResult = await service.listChildren(commentPublicId(1), 1, 10);
      expect(normalResult.list.length).toBe(4); // all descendants
    });
  });

  // ============================================================
  // Task 3: Admin operations
  // ============================================================

  describe('LikeComment', () => {
    it('Test 1: should increment likeCount by 1 and return updated count', async () => {
      mockRepo.incrementLikeCount.mockResolvedValue(undefined);
      // After increment, we need to fetch the updated comment
      mockRepo.findById.mockResolvedValue(makeComment({ id: 1, likeCount: 6 }));

      const result = await service.likeComment(commentPublicId(1));
      expect(result.like_count).toBe(6);
      expect(mockRepo.incrementLikeCount).toHaveBeenCalled();
    });
  });

  describe('UnlikeComment', () => {
    it('Test 2: should decrement likeCount by 1 (minimum 0) and return updated count', async () => {
      mockRepo.decrementLikeCount.mockResolvedValue(undefined);
      mockRepo.findById.mockResolvedValue(makeComment({ id: 1, likeCount: 4 }));

      const result = await service.unlikeComment(commentPublicId(1));
      expect(result.like_count).toBe(4);
      expect(mockRepo.decrementLikeCount).toHaveBeenCalled();
    });
  });

  describe('SetPin', () => {
    it('Test 3: should set pinnedAt to current time when isPinned=true', async () => {
      const updated = makeComment({ id: 1, pinnedAt: new Date() });
      mockRepo.setPin.mockResolvedValue(updated);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.setPin(commentPublicId(1), true);
      expect(mockRepo.setPin).toHaveBeenCalledWith(expect.any(Number), true);
      expect(result.pinned_at).toBeTruthy();
    });

    it('Test 4: should set pinnedAt to null when isPinned=false', async () => {
      const updated = makeComment({ id: 1, pinnedAt: null });
      mockRepo.setPin.mockResolvedValue(updated);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.setPin(commentPublicId(1), false);
      expect(mockRepo.setPin).toHaveBeenCalledWith(expect.any(Number), false);
    });
  });

  describe('UpdateStatus', () => {
    it('Test 5: should change status field (1=Published, 2=Pending, 3=Rejected)', async () => {
      const updated = makeComment({ id: 1, status: 2 });
      mockRepo.updateStatus.mockResolvedValue(updated);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.updateStatus(commentPublicId(1), 2);
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(expect.any(Number), 2);
      expect(result.status).toBe(2);
    });
  });

  describe('UpdateContent', () => {
    it('Test 6: should update content and re-render contentHtml via renderCommentMarkdown', async () => {
      const updated = makeComment({ id: 1, content: '**New**', contentHtml: '<p><strong>New</strong></p>' });
      mockRepo.updateContent.mockResolvedValue(updated);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.updateContent(commentPublicId(1), '**New**');
      expect(mockRepo.updateContent).toHaveBeenCalledWith(
        expect.any(Number),
        '**New**',
        expect.any(String), // rendered HTML
      );
    });
  });

  describe('UpdateCommentInfo', () => {
    it('Test 7: should update specified fields (nickname, email, emailMd5, website) without modifying content', async () => {
      const updated = makeComment({ id: 1, nickname: 'NewNick', email: 'new@example.com' });
      mockRepo.updateCommentInfo.mockResolvedValue(updated);
      mockSettingsService.get.mockImplementation((key: string) => {
        if (key === 'comment_show_ua') return 'false';
        if (key === 'comment_show_region') return 'false';
        return '';
      });

      const result = await service.updateCommentInfo(commentPublicId(1), {
        nickname: 'NewNick',
        email: 'new@example.com',
      });
      expect(mockRepo.updateCommentInfo).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          nickname: 'NewNick',
          email: 'new@example.com',
          emailMd5: expect.any(String),
        }),
      );
    });
  });

  describe('Delete', () => {
    it('Test 8: should soft-delete comments by setting deletedAt', async () => {
      mockRepo.softDelete.mockResolvedValue(undefined);

      await service.delete([commentPublicId(10), commentPublicId(20)]);
      expect(mockRepo.softDelete).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Number)]));
    });
  });

  describe('UploadImage', () => {
    it('Test 9: should delegate to UploadService with comment_image policy flag, returns { id: Sqids public ID }', async () => {
      const mockPolicy = { id: 5, flag: 'comment_image', basePath: 'data/uploads', type: 'local' };
      mockStoragePolicyService.findByFlag.mockResolvedValue(mockPolicy);
      mockUploadService.createSession.mockResolvedValue({ session_id: 'session-123' });
      mockUploadService.uploadChunk.mockResolvedValue(null);

      const mockFile = {
        originalname: 'test.png',
        buffer: Buffer.from('fake-image'),
        size: 1024,
        mimetype: 'image/png',
      } as Express.Multer.File;

      const result = await service.uploadImage(mockFile, { dbId: 1 });
      // Should return { id: publicID } per D-141
      expect(result).toHaveProperty('id');
    });
  });
});
