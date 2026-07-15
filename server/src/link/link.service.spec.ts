import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkService } from './link.service';
import { LinkRepository } from './link.repository';
import { LinkApplyRateLimiter } from './link-apply-rate-limiter';
import { SettingsService } from '../settings/settings.service';
import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../common/constants/error-codes';

// Mock sqids util
vi.mock('../common/utils/sqids.util', () => ({
  generatePublicID: vi.fn((dbId: number, entityType: number) => `sqid_${dbId}_${entityType}`),
  decodePublicID: vi.fn((publicId: string) => {
    // Parse our test format: sqid_{dbId}_{entityType}
    const match = publicId.match(/^sqid_(\d+)_(\d+)$/);
    if (match) return { dbID: parseInt(match[1]), entityType: parseInt(match[2]) };
    // Parse numeric format for category/tag IDs
    const num = parseInt(publicId);
    if (!isNaN(num)) return { dbID: num, entityType: 22 };
    throw new Error('Invalid public ID');
  }),
  EntityType: {
    User: 1, File: 2, Album: 3, UserGroup: 4, StoragePolicy: 5,
    StorageEntity: 6, DirectLink: 7, Article: 8, PostTag: 9,
    PostCategory: 10, Comment: 11, DocSeries: 12, Product: 13,
    ProductVariant: 14, StockItem: 15, MembershipPlan: 16,
    UserMembership: 17, SupportTicket: 18, TicketMessage: 19,
    Notification: 20, ArticleHistory: 21, Link: 22,
  },
}));

describe('LinkService', () => {
  let service: LinkService;
  let repo: LinkRepository;
  let rateLimiter: LinkApplyRateLimiter;
  let settingsService: SettingsService;

  const mockLink = {
    id: 1,
    name: 'Test Link',
    url: 'https://example.com',
    rssUrl: null,
    logo: 'https://example.com/logo.png',
    description: 'A test link',
    status: 'PENDING',
    siteshot: null,
    email: 'test@example.com',
    type: 'NEW',
    originalUrl: null,
    updateReason: null,
    sortOrder: 0,
    skipHealthCheck: false,
    categoryId: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockCategory = {
    id: 2,
    name: 'Default',
    style: 'list',
    description: 'Default category',
  };

  const mockCardCategory = {
    id: 3,
    name: 'Card Category',
    style: 'card',
    description: 'Card style category',
  };

  const mockTag = {
    id: 5,
    name: 'Tech',
    color: '#409EFF',
  };

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUrl: vi.fn(),
      hasApplicationByEmail: vi.fn(),
      findApprovedLinks: vi.fn(),
      findRandomApproved: vi.fn(),
      adminList: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
      batchUpdateSort: vi.fn(),
      findLinksForHealthCheck: vi.fn(),
      createCategory: vi.fn(),
      findAllCategories: vi.fn(),
      findCategoryById: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategoryIfUnused: vi.fn(),
      createTag: vi.fn(),
      findAllTags: vi.fn(),
      findTagById: vi.fn(),
      findTagByName: vi.fn(),
      updateTag: vi.fn(),
      deleteTagIfUnused: vi.fn(),
      setLinkTag: vi.fn(),
      getLinkTag: vi.fn(),
      findPublicCategories: vi.fn(),
    } as any;

    rateLimiter = {
      checkLimit: vi.fn(),
    } as any;

    settingsService = {
      get: vi.fn(),
    } as any;

    service = new LinkService(repo, rateLimiter, settingsService, { dispatchLinkCleanup: vi.fn() } as any);
  });

  // ─── Test 1: applyLink validates request, checks email repeat, checks URL exists,
  //              creates PENDING link, fires Pushoo notification ──────────────────
  describe('applyLink', () => {
    const applyDto = {
      type: 'NEW',
      name: 'Test Link',
      url: 'https://example.com',
      email: 'test@example.com',
      logo: 'https://example.com/logo.png',
      description: 'A test link',
    };

    it('should create PENDING link and return LinkResponseDto', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        if (key === 'friend_link_default_category') return '2';
        return '';
      });
      vi.mocked(repo.hasApplicationByEmail).mockResolvedValue(false);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.create).mockResolvedValue(mockLink);

      const result = await service.applyLink(applyDto, '127.0.0.1');

      expect(result).toBeDefined();
      expect(result.id).toBe('sqid_1_22');
      expect(result.status).toBe('PENDING');
      expect(result.name).toBe('Test Link');
      expect(rateLimiter.checkLimit).toHaveBeenCalledWith('127.0.0.1', 1);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Link',
          url: 'https://example.com',
          status: 'PENDING',
          categoryId: 2,
        }),
      );
    });

    it('should normalize email to lowercase and trim', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        if (key === 'friend_link_default_category') return '2';
        return '';
      });
      vi.mocked(repo.hasApplicationByEmail).mockResolvedValue(false);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.create).mockResolvedValue(mockLink);

      await service.applyLink(
        { ...applyDto, email: '  Test@Example.COM  ' },
        '127.0.0.1',
      );

      expect(repo.hasApplicationByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ─── Test 2: applyLink throws LINK_APPLY_RATE_LIMITED when IP exceeds daily limit ─
  describe('applyLink rate limiting', () => {
    it('should throw LINK_APPLY_RATE_LIMITED when rate limit exceeded', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        return '';
      });
      vi.mocked(rateLimiter.checkLimit).mockImplementation(() => {
        throw new BadRequestException(ErrorCodes.LINK_APPLY_RATE_LIMITED);
      });

      await expect(
        service.applyLink(
          { type: 'NEW', name: 'Test', url: 'https://example.com', email: 'test@example.com' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ErrorCodes.LINK_APPLY_RATE_LIMITED);
    });
  });

  // ─── Test 3: applyLink throws LINK_URL_EXISTS when URL already has a link and type=NEW ─
  describe('applyLink URL dedup', () => {
    it('should throw LINK_URL_EXISTS when URL exists and type=NEW', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        return '';
      });
      vi.mocked(repo.hasApplicationByEmail).mockResolvedValue(false);
      vi.mocked(repo.findByUrl).mockResolvedValue(mockLink);

      await expect(
        service.applyLink(
          { type: 'NEW', name: 'Test', url: 'https://example.com', email: 'test@example.com' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ErrorCodes.LINK_URL_EXISTS);
    });

    it('should allow UPDATE type when URL exists', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        if (key === 'friend_link_default_category') return '2';
        return '';
      });
      vi.mocked(repo.hasApplicationByEmail).mockResolvedValue(false);
      vi.mocked(repo.findByUrl).mockResolvedValue(mockLink);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.create).mockResolvedValue({
        ...mockLink,
        type: 'UPDATE',
        originalUrl: 'https://example.com',
      });

      const result = await service.applyLink(
        { type: 'UPDATE', name: 'Test', url: 'https://example.com', email: 'test@example.com' },
        '127.0.0.1',
      );

      expect(result).toBeDefined();
    });
  });

  // ─── Test 4: applyLink throws LINK_SITESHOT_REQUIRED when category style=card and no siteshot ─
  describe('applyLink siteshot validation', () => {
    it('should throw LINK_SITESHOT_REQUIRED when card style and no siteshot', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        if (key === 'friend_link_default_category') return '3';
        return '';
      });
      vi.mocked(repo.hasApplicationByEmail).mockResolvedValue(false);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCardCategory);

      await expect(
        service.applyLink(
          { type: 'NEW', name: 'Test', url: 'https://example.com', email: 'test@example.com' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ErrorCodes.LINK_SITESHOT_REQUIRED);
    });

    it('should allow card style with siteshot provided', async () => {
      settingsService.get = vi.fn((key: string) => {
        if (key === 'friend_link_apply_limit') return '1';
        if (key === 'friend_link_default_category') return '3';
        return '';
      });
      vi.mocked(repo.hasApplicationByEmail).mockResolvedValue(false);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCardCategory);
      vi.mocked(repo.create).mockResolvedValue({
        ...mockLink,
        categoryId: 3,
        siteshot: 'https://example.com/shot.png',
      });

      const result = await service.applyLink(
        {
          type: 'NEW',
          name: 'Test',
          url: 'https://example.com',
          email: 'test@example.com',
          siteshot: 'https://example.com/shot.png',
        },
        '127.0.0.1',
      );

      expect(result).toBeDefined();
    });
  });

  // ─── Test 5: listPublicLinks returns APPROVED links grouped by category ──────────
  describe('listPublicLinks', () => {
    it('should return APPROVED links grouped by category with tag data', async () => {
      vi.mocked(repo.findApprovedLinks).mockResolvedValue([
        { link: { ...mockLink, status: 'APPROVED', id: 1 }, category: mockCategory, tag: mockTag },
        { link: { ...mockLink, status: 'APPROVED', id: 2, name: 'Link 2' }, category: mockCategory, tag: null },
      ]);

      const result = await service.listPublicLinks();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // First category should have links array
      expect(result[0].links).toBeDefined();
      expect(result[0].id).toBe(2); // raw integer ID per D-179
    });

    it('should return empty array when no APPROVED links', async () => {
      vi.mocked(repo.findApprovedLinks).mockResolvedValue([]);

      const result = await service.listPublicLinks();

      expect(result).toEqual([]);
    });
  });

  // ─── Test 6: getRandomLinks returns N random APPROVED links ──────────────────────
  describe('getRandomLinks', () => {
    it('should return all APPROVED links when count=0', async () => {
      vi.mocked(repo.findRandomApproved).mockResolvedValue([
        { link: { ...mockLink, status: 'APPROVED' }, category: mockCategory, tag: mockTag },
      ]);

      const result = await service.getRandomLinks(0);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return N random APPROVED links when count>0', async () => {
      vi.mocked(repo.findRandomApproved).mockResolvedValue([
        { link: { ...mockLink, status: 'APPROVED', id: 1 }, category: mockCategory, tag: mockTag },
        { link: { ...mockLink, status: 'APPROVED', id: 2 }, category: mockCategory, tag: null },
      ]);

      const result = await service.getRandomLinks(2);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(repo.findRandomApproved).toHaveBeenCalledWith(2);
    });
  });

  // ─── Test 7: checkLinkExists returns {exists: true/false, url} ───────────────────
  describe('checkLinkExists', () => {
    it('should return {exists: true, url} when APPROVED link exists', async () => {
      vi.mocked(repo.findByUrl).mockResolvedValue({ ...mockLink, status: 'APPROVED' });

      const result = await service.checkLinkExists('https://example.com');

      expect(result).toEqual({ exists: true, url: 'https://example.com' });
    });

    it('should return {exists: false, url} when no APPROVED link exists', async () => {
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);

      const result = await service.checkLinkExists('https://notfound.com');

      expect(result).toEqual({ exists: false, url: 'https://notfound.com' });
    });

    it('should return {exists: false, url} when link exists but not APPROVED', async () => {
      vi.mocked(repo.findByUrl).mockResolvedValue({ ...mockLink, status: 'PENDING' });

      const result = await service.checkLinkExists('https://example.com');

      expect(result).toEqual({ exists: false, url: 'https://example.com' });
    });
  });

  // ─── Test 8: listApplications returns all link applications ──────────────────────
  describe('listApplications', () => {
    it('should return all links (all statuses)', async () => {
      vi.mocked(repo.findApprovedLinks).mockResolvedValue([]);
      // listApplications uses a different repo method
      vi.mocked(repo.adminList).mockResolvedValue({
        list: [
          { link: mockLink, category: mockCategory, tag: mockTag },
        ],
        total: 1,
      });

      const result = await service.listApplications();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Test 9: adminCreateLink creates a link with specified status and category/tag ─
  describe('adminCreateLink', () => {
    it('should create link and return LinkResponseDto', async () => {
      const dto = {
        name: 'Admin Link',
        url: 'https://admin-link.com',
        category_id: 2,
        tag_id: 5,
        status: 'APPROVED',
      };
      vi.mocked(repo.create).mockResolvedValue({ ...mockLink, ...dto, id: 10 });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.findTagById).mockResolvedValue(mockTag);

      const result = await service.adminCreateLink(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('sqid_10_22');
      expect(repo.create).toHaveBeenCalled();
      expect(repo.setLinkTag).toHaveBeenCalledWith(10, 5);
    });
  });

  // ─── Test 10: adminListLinks returns paginated links with filters ────────────────
  describe('adminListLinks', () => {
    it('should return paginated links with filters', async () => {
      vi.mocked(repo.adminList).mockResolvedValue({
        list: [
          { link: mockLink, category: mockCategory, tag: mockTag },
        ],
        total: 1,
      });

      const result = await service.adminListLinks({ page: 1, pageSize: 10 });

      expect(result).toBeDefined();
      expect(result.list).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });
  });

  // ─── Test 11: adminUpdateLink updates link fields and sets status=UPDATED if link was APPROVED ─
  describe('adminUpdateLink', () => {
    it('should set status=UPDATED when link was APPROVED and status is changing', async () => {
      vi.mocked(repo.findById).mockResolvedValue({ ...mockLink, status: 'APPROVED' });
      vi.mocked(repo.update).mockResolvedValue({ ...mockLink, status: 'UPDATED' });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.getLinkTag).mockResolvedValue(null);

      const result = await service.adminUpdateLink('sqid_1_22', {
        name: 'Updated Link',
        status: 'UPDATED',
      });

      expect(result).toBeDefined();
      expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'UPDATED' }));
    });

    it('should throw LINK_NOT_FOUND when link does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(undefined);

      await expect(
        service.adminUpdateLink('sqid_999_22', { name: 'Updated' }),
      ).rejects.toThrow(ErrorCodes.LINK_NOT_FOUND);
    });
  });

  // ─── Test 12: adminDeleteLink soft-deletes a link ────────────────────────────────
  describe('adminDeleteLink', () => {
    it('should soft-delete a link by public ID', async () => {
      await service.adminDeleteLink('sqid_1_22');

      expect(repo.softDelete).toHaveBeenCalledWith([1]);
    });
  });

  // ─── Test 13: adminBatchDeleteLinks soft-deletes multiple links ──────────────────
  describe('adminBatchDeleteLinks', () => {
    it('should soft-delete multiple links and return result', async () => {
      const result = await service.adminBatchDeleteLinks({
        ids: ['sqid_1_22', 'sqid_2_22'],
      });

      expect(result).toBeDefined();
      expect(result.total).toBe(2);
      expect(repo.softDelete).toHaveBeenCalledWith([1, 2]);
    });

    it('should handle invalid IDs gracefully', async () => {
      const result = await service.adminBatchDeleteLinks({
        ids: ['sqid_1_22', 'invalid_id'],
      });

      expect(result.total).toBe(2);
      // Invalid ID should be in failed list
      expect(result.failed).toBeGreaterThan(0);
    });
  });

  // ─── Test 14: reviewLink updates status to APPROVED/REJECTED ─────────────────────
  describe('reviewLink', () => {
    it('should approve link and update status', async () => {
      vi.mocked(repo.findById).mockResolvedValue({ ...mockLink, status: 'PENDING' });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.updateStatus).mockResolvedValue(undefined);

      const result = await service.reviewLink('sqid_1_22', {
        status: 'APPROVED',
      });

      expect(repo.updateStatus).toHaveBeenCalledWith(1, 'APPROVED', undefined, undefined);
    });

    it('should throw LINK_SITESHOT_REQUIRED when approving card style link without siteshot', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        ...mockLink,
        status: 'PENDING',
        categoryId: 3,
      });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCardCategory);

      await expect(
        service.reviewLink('sqid_1_22', { status: 'APPROVED' }),
      ).rejects.toThrow(ErrorCodes.LINK_SITESHOT_REQUIRED);
    });

    it('should allow approving card style link with siteshot', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        ...mockLink,
        status: 'PENDING',
        categoryId: 3,
      });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCardCategory);
      vi.mocked(repo.updateStatus).mockResolvedValue(undefined);

      await service.reviewLink('sqid_1_22', {
        status: 'APPROVED',
        siteshot: 'https://example.com/shot.png',
      });

      expect(repo.updateStatus).toHaveBeenCalledWith(
        1,
        'APPROVED',
        'https://example.com/shot.png',
        undefined,
      );
    });

    it('should reject link with optional reject_reason', async () => {
      vi.mocked(repo.findById).mockResolvedValue({ ...mockLink, status: 'PENDING' });
      vi.mocked(repo.updateStatus).mockResolvedValue(undefined);

      await service.reviewLink('sqid_1_22', {
        status: 'REJECTED',
        reject_reason: 'Not suitable',
      });

      expect(repo.updateStatus).toHaveBeenCalledWith(
        1,
        'REJECTED',
        undefined,
        'Not suitable',
      );
    });
  });

  // ─── Test 15: toLinkResponseDTO encodes link ID with EntityType.Link ─────────────
  describe('toLinkResponseDTO', () => {
    it('should encode link ID with EntityType.Link per D-175', async () => {
      const result = await service.toLinkResponseDTO(mockLink, mockCategory, mockTag);

      expect(result.id).toBe('sqid_1_22');
      expect(result.name).toBe('Test Link');
      expect(result.url).toBe('https://example.com');
    });

    it('should include category with raw integer ID (not Sqids-encoded)', async () => {
      const result = await service.toLinkResponseDTO(mockLink, mockCategory, null);

      expect(result.category).toBeDefined();
      expect(result.category.id).toBe(2); // raw integer, not Sqids-encoded
      expect(result.category.name).toBe('Default');
    });

    it('should include tag with raw integer ID (not Sqids-encoded)', async () => {
      const result = await service.toLinkResponseDTO(mockLink, mockCategory, mockTag);

      expect(result.tag).toBeDefined();
      expect(result.tag.id).toBe(5); // raw integer, not Sqids-encoded
      expect(result.tag.name).toBe('Tech');
    });

    it('should handle null category and tag', async () => {
      const result = await service.toLinkResponseDTO(mockLink, null, null);

      expect(result.category).toBeNull();
      expect(result.tag).toBeNull();
    });
  });

  // ─── Test 16: importLinks processes JSON import with category/tag resolution and dedup ─
  describe('importLinks', () => {
    it('should import links with category/tag resolution and dedup per D-173', async () => {
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCategory]);
      vi.mocked(repo.findAllTags).mockResolvedValue([mockTag]);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockResolvedValue({ ...mockLink, id: 10 });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.findTagById).mockResolvedValue(mockTag);

      const dto = {
        links: [
          {
            name: 'Import Link',
            url: 'https://import.com',
            category_name: 'Default',
            tag_name: 'Tech',
            status: 'APPROVED',
          },
        ],
        skip_duplicates: false,
        create_categories: false,
        create_tags: false,
      };

      const result = await service.importLinks(dto);

      expect(result).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should skip duplicates when skip_duplicates=true', async () => {
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCategory]);
      vi.mocked(repo.findAllTags).mockResolvedValue([]);
      vi.mocked(repo.findByUrl).mockResolvedValue({ ...mockLink, categoryId: 2 });

      const dto = {
        links: [
          {
            name: 'Duplicate Link',
            url: 'https://example.com',
            category_name: 'Default',
          },
        ],
        skip_duplicates: true,
        create_categories: false,
        create_tags: false,
      };

      const result = await service.importLinks(dto);

      expect(result.skipped).toBe(1);
      expect(result.success).toBe(0);
    });

    it('should auto-create categories when create_categories=true', async () => {
      vi.mocked(repo.findAllCategories).mockResolvedValue([]);
      vi.mocked(repo.findAllTags).mockResolvedValue([]);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.createCategory).mockResolvedValue({ id: 10, name: 'New Cat', style: 'list', description: '' });
      vi.mocked(repo.create).mockResolvedValue({ ...mockLink, id: 20, categoryId: 10 });
      vi.mocked(repo.findCategoryById).mockResolvedValue({ id: 10, name: 'New Cat', style: 'list', description: '' });

      const dto = {
        links: [
          {
            name: 'Import Link',
            url: 'https://import.com',
            category_name: 'New Cat',
          },
        ],
        create_categories: true,
        create_tags: false,
      };

      const result = await service.importLinks(dto);

      expect(result.success).toBe(1);
      expect(repo.createCategory).toHaveBeenCalled();
    });

    it('should auto-create tags when create_tags=true', async () => {
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCategory]);
      vi.mocked(repo.findAllTags).mockResolvedValue([]);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.createTag).mockResolvedValue({ id: 15, name: 'NewTag', color: '#409EFF' });
      vi.mocked(repo.create).mockResolvedValue({ ...mockLink, id: 20 });
      vi.mocked(repo.findCategoryById).mockResolvedValue(mockCategory);
      vi.mocked(repo.findTagById).mockResolvedValue({ id: 15, name: 'NewTag', color: '#409EFF' });

      const dto = {
        links: [
          {
            name: 'Import Link',
            url: 'https://import.com',
            category_name: 'Default',
            tag_name: 'NewTag',
            tag_color: '#FF0000',
          },
        ],
        create_categories: false,
        create_tags: true,
      };

      const result = await service.importLinks(dto);

      expect(result.success).toBe(1);
      expect(repo.createTag).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NewTag', color: '#FF0000' }),
      );
    });

    it('should skip intra-import duplicates', async () => {
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCategory]);
      vi.mocked(repo.findAllTags).mockResolvedValue([]);
      vi.mocked(repo.findByUrl).mockResolvedValue(undefined);
      vi.mocked(repo.create).mockResolvedValue({ ...mockLink, id: 20 });

      const dto = {
        links: [
          { name: 'Link 1', url: 'https://same.com', category_name: 'Default' },
          { name: 'Link 2', url: 'https://same.com', category_name: 'Default' },
        ],
        skip_duplicates: false,
        create_categories: false,
        create_tags: false,
      };

      const result = await service.importLinks(dto);

      // Second link should be skipped as intra-import duplicate
      expect(result.skipped).toBe(1);
    });
  });

  // ─── Test 17: exportLinks returns all matching links in ImportLinkItem format ─────
  describe('exportLinks', () => {
    it('should return links in ImportLinkItem format per D-173', async () => {
      vi.mocked(repo.adminList).mockResolvedValue({
        list: [
          { link: mockLink, category: mockCategory, tag: mockTag },
        ],
        total: 1,
      });

      const result = await service.exportLinks();

      expect(result).toBeDefined();
      expect(result.links).toBeDefined();
      expect(result.total).toBe(1);
      expect(result.links[0].name).toBe('Test Link');
      expect(result.links[0].category_name).toBe('Default');
      expect(result.links[0].tag_name).toBe('Tech');
      expect(result.links[0].tag_color).toBe('#409EFF');
    });
  });

  // ─── Test 18: healthCheck triggers async HTTP GET checks ──────────────────────────
  describe('healthCheck', () => {
    it('should throw LINK_HEALTH_CHECK_RUNNING when already running', async () => {
      // Simulate running state
      (service as any).healthCheckStatus = { is_running: true };

      await expect(service.healthCheck()).rejects.toThrow(
        ErrorCodes.LINK_HEALTH_CHECK_RUNNING,
      );

      // Reset
      (service as any).healthCheckStatus = { is_running: false };
    });

    it('should start health check and return immediately', async () => {
      (service as any).healthCheckStatus = { is_running: false };

      // Mock findLinksForHealthCheck to return empty array
      vi.mocked(repo.findLinksForHealthCheck).mockResolvedValue([]);

      await service.healthCheck();

      // Should have set is_running to true initially, then false after completion
      // Since we mock empty links, it completes synchronously
      const status = service.getHealthCheckStatus();
      expect(status.is_running).toBe(false);
    });
  });

  // ─── Test 19: getHealthCheckStatus returns current health check progress ──────────
  describe('getHealthCheckStatus', () => {
    it('should return current health check status per D-172', () => {
      (service as any).healthCheckStatus = {
        is_running: false,
        start_time: '2026-07-11T00:00:00Z',
        end_time: '2026-07-11T00:01:00Z',
        result: { total: 10, healthy: 8, unhealthy: 2, unhealthy_ids: [3, 7] },
        error: '',
      };

      const status = service.getHealthCheckStatus();

      expect(status.is_running).toBe(false);
      expect(status.result).toBeDefined();
      expect(status.result!.total).toBe(10);
      expect(status.result!.healthy).toBe(8);
      expect(status.result!.unhealthy).toBe(2);
    });
  });

  // ─── Test 20: batchUpdateSort updates sortOrder for multiple links ────────────────
  describe('batchUpdateSort', () => {
    it('should update sortOrder for multiple links per D-174', async () => {
      await service.batchUpdateSort({
        items: [
          { id: 'sqid_1_22', sort_order: 5 },
          { id: 'sqid_2_22', sort_order: 10 },
        ],
      });

      expect(repo.batchUpdateSort).toHaveBeenCalledWith([
        { id: 1, sortOrder: 5 },
        { id: 2, sortOrder: 10 },
      ]);
    });
  });

  // ─── Test 21: category CRUD ──────────────────────────────────────────────────────
  describe('category CRUD', () => {
    it('should create category', async () => {
      vi.mocked(repo.createCategory).mockResolvedValue({
        id: 10, name: 'New Category', style: 'card', description: 'Test',
      });

      const result = await service.createCategory({
        name: 'New Category',
        style: 'card',
        description: 'Test',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(10);
      expect(result.name).toBe('New Category');
    });

    it('should list categories', async () => {
      vi.mocked(repo.findAllCategories).mockResolvedValue([mockCategory]);

      const result = await service.listCategories();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(2);
    });

    it('should update category', async () => {
      vi.mocked(repo.updateCategory).mockResolvedValue({
        id: 2, name: 'Updated Category', style: 'list', description: 'Updated',
      });

      const result = await service.updateCategory('2', {
        name: 'Updated Category',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Category');
    });

    it('should delete category if unused', async () => {
      vi.mocked(repo.deleteCategoryIfUnused).mockResolvedValue(undefined);

      await service.deleteCategory('2');

      expect(repo.deleteCategoryIfUnused).toHaveBeenCalledWith(2);
    });

    it('should list public categories', async () => {
      vi.mocked(repo.findPublicCategories).mockResolvedValue([mockCategory]);

      const result = await service.listPublicCategories();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
    });
  });

  // ─── Test 22: tag CRUD ───────────────────────────────────────────────────────────
  describe('tag CRUD', () => {
    it('should create tag', async () => {
      vi.mocked(repo.createTag).mockResolvedValue({
        id: 10, name: 'New Tag', color: '#FF0000',
      });

      const result = await service.createTag({
        name: 'New Tag',
        color: '#FF0000',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(10);
      expect(result.name).toBe('New Tag');
    });

    it('should list tags', async () => {
      vi.mocked(repo.findAllTags).mockResolvedValue([mockTag]);

      const result = await service.listTags();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(5);
    });

    it('should update tag', async () => {
      vi.mocked(repo.updateTag).mockResolvedValue({
        id: 5, name: 'Updated Tag', color: '#00FF00',
      });

      const result = await service.updateTag('5', {
        name: 'Updated Tag',
        color: '#00FF00',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Tag');
    });

    it('should delete tag if unused', async () => {
      vi.mocked(repo.deleteTagIfUnused).mockResolvedValue(undefined);

      await service.deleteTag('5');

      expect(repo.deleteTagIfUnused).toHaveBeenCalledWith(5);
    });
  });
});
