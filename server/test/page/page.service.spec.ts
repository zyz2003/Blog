import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PageService, normalizePath, splitContentAndCustomJS } from '../../src/page/page.service';
import { PageRepository } from '../../src/page/page.repository';
import { ErrorCodes } from '../../src/common/constants/error-codes';
import {
  createMockPage,
  createMockCreatePageDto,
  createMockUpdatePageDto,
  TEST_IDS,
} from '../helpers/page-fixtures';

describe('normalizePath', () => {
  it('should return empty string for empty input', () => {
    expect(normalizePath('')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(normalizePath('  /privacy  ')).toBe('/privacy');
  });

  it('should prepend / if missing', () => {
    expect(normalizePath('privacy')).toBe('/privacy');
  });

  it('should strip trailing / except for root', () => {
    expect(normalizePath('/privacy/')).toBe('/privacy');
  });

  it('should preserve root path /', () => {
    expect(normalizePath('/')).toBe('/');
  });

  it('should handle already normalized path', () => {
    expect(normalizePath('/privacy')).toBe('/privacy');
  });

  it('should handle whitespace-only input', () => {
    expect(normalizePath('   ')).toBe('');
  });
});

describe('splitContentAndCustomJS', () => {
  it('should return original content and empty customJs when no script tags', () => {
    const result = splitContentAndCustomJS('<p>Hello</p>');
    expect(result.content).toBe('<p>Hello</p>');
    expect(result.customJs).toBe('');
  });

  it('should extract single script tag content', () => {
    const result = splitContentAndCustomJS(
      '<p>Hello</p><script>console.log("hi")</script>',
    );
    expect(result.content).toBe('<p>Hello</p>');
    expect(result.customJs).toBe('console.log("hi")');
  });

  it('should extract multiple script tags', () => {
    const result = splitContentAndCustomJS(
      '<script>var a=1</script><p>Text</p><script>var b=2</script>',
    );
    expect(result.content).toBe('<p>Text</p>');
    expect(result.customJs).toBe('var a=1\n\nvar b=2');
  });

  it('should handle script tag with attributes', () => {
    const result = splitContentAndCustomJS(
      '<script type="text/javascript">code</script>',
    );
    expect(result.content).toBe('');
    expect(result.customJs).toBe('code');
  });

  it('should handle case-insensitive script tags', () => {
    const result = splitContentAndCustomJS(
      '<SCRIPT>code</SCRIPT>',
    );
    expect(result.customJs).toBe('code');
  });

  it('should handle multiline script content', () => {
    const result = splitContentAndCustomJS(
      '<script>\nline1\nline2\n</script>',
    );
    expect(result.customJs).toContain('line1');
    expect(result.customJs).toContain('line2');
  });
});

describe('PageService', () => {
  let service: PageService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findById: vi.fn(),
      findByPath: vi.fn(),
      existsByPath: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      list: vi.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PageService,
        { provide: PageRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(PageService);
  });

  describe('validatePath', () => {
    it('should throw BadRequestException for empty path', () => {
      expect(() => service.validatePath('')).toThrow(BadRequestException);
      try {
        service.validatePath('');
      } catch (e: any) {
        expect(e.message).toBe(ErrorCodes.PAGE_PATH_EMPTY);
      }
    });

    it('should throw BadRequestException for path not starting with /', () => {
      expect(() => service.validatePath('privacy')).toThrow(BadRequestException);
      try {
        service.validatePath('privacy');
      } catch (e: any) {
        expect(e.message).toBe(ErrorCodes.PAGE_PATH_NO_SLASH);
      }
    });

    it('should throw BadRequestException for path containing spaces', () => {
      expect(() => service.validatePath('/my page')).toThrow(BadRequestException);
      try {
        service.validatePath('/my page');
      } catch (e: any) {
        expect(e.message).toBe(ErrorCodes.PAGE_PATH_HAS_SPACE);
      }
    });

    it('should throw BadRequestException for path containing special chars', () => {
      const specialChars = ['<', '>', '"', "'", '&', '?', '#', '=', '+', ';'];
      for (const char of specialChars) {
        expect(() => service.validatePath(`/path${char}value`)).toThrow(BadRequestException);
      }
    });

    it('should pass for valid path like /privacy', () => {
      expect(() => service.validatePath('/privacy')).not.toThrow();
    });
  });

  describe('create', () => {
    it('should normalize path, validate, check uniqueness, and create page', async () => {
      const dto = createMockCreatePageDto();
      const createdPage = createMockPage({
        title: dto.title,
        path: dto.path,
      });
      repo.existsByPath.mockResolvedValue(false);
      repo.create.mockResolvedValue(createdPage);

      const result = await service.create(dto);

      expect(repo.existsByPath).toHaveBeenCalledWith(dto.path);
      expect(repo.create).toHaveBeenCalled();
      // Service returns toApiResponse format (snake_case, ISO dates)
      expect(result.id).toBe(createdPage.id);
      expect(result.title).toBe(createdPage.title);
      expect(result.path).toBe(createdPage.path);
    });

    it('should throw ConflictException when path already exists', async () => {
      const dto = createMockCreatePageDto();
      repo.existsByPath.mockResolvedValue(true);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid path with special chars', async () => {
      const dto = createMockCreatePageDto({ path: '/invalid?path' });

      await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getById', () => {
    it('should return page when found', async () => {
      const mockPage = createMockPage();
      repo.findById.mockResolvedValue(mockPage);

      const result = await service.getById(TEST_IDS.PAGE_1);

      expect(result.id).toBe(mockPage.id);
      expect(result.title).toBe(mockPage.title);
      expect(result.path).toBe(mockPage.path);
    });

    it('should throw NotFoundException when page not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.getById(TEST_IDS.PAGE_1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByPath', () => {
    it('should find page by normalized path', async () => {
      const mockPage = createMockPage({ path: '/privacy' });
      repo.findByPath.mockResolvedValue(mockPage);

      const result = await service.getByPath('/privacy');

      expect(result.id).toBe(mockPage.id);
      expect(result.path).toBe(mockPage.path);
      expect(repo.findByPath).toHaveBeenCalledWith('/privacy');
    });

    it('should find page by trailing-slash fallback', async () => {
      const mockPage = createMockPage({ path: '/privacy/' });
      // First call: normalized path /privacy returns null
      repo.findByPath.mockResolvedValueOnce(null);
      // Second call: trailing slash fallback /privacy/ returns page
      repo.findByPath.mockResolvedValueOnce(mockPage);

      const result = await service.getByPath('/privacy');

      expect(result.id).toBe(mockPage.id);
      expect(repo.findByPath).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when page not found', async () => {
      repo.findByPath.mockResolvedValue(null);

      await expect(service.getByPath('/nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should return { pages, total, page, size } format', async () => {
      const mockPages = [createMockPage()];
      repo.list.mockResolvedValue({ list: mockPages, total: 1 });

      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].id).toBe(mockPages[0].id);
      expect(result.pages[0].path).toBe(mockPages[0].path);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.size).toBe(10);
    });
  });

  describe('update', () => {
    it('should update page with provided fields', async () => {
      const existingPage = createMockPage();
      const updateData = { title: 'Updated Title' };
      const updatedPage = createMockPage({ title: 'Updated Title' });
      repo.findById.mockResolvedValue(existingPage);
      repo.update.mockResolvedValue(updatedPage);

      const result = await service.update(TEST_IDS.PAGE_1, updateData);

      expect(repo.update).toHaveBeenCalled();
      expect(result.id).toBe(updatedPage.id);
      expect(result.title).toBe('Updated Title');
    });

    it('should validate and check uniqueness when path changes', async () => {
      const existingPage = createMockPage({ path: '/old-path' });
      const updateData = { path: '/new-path' };
      const updatedPage = createMockPage({ path: '/new-path' });
      repo.findById.mockResolvedValue(existingPage);
      repo.existsByPath.mockResolvedValue(false);
      repo.update.mockResolvedValue(updatedPage);

      const result = await service.update(TEST_IDS.PAGE_1, updateData);

      expect(repo.existsByPath).toHaveBeenCalledWith('/new-path', TEST_IDS.PAGE_1);
      expect(result.id).toBe(updatedPage.id);
      expect(result.path).toBe('/new-path');
    });

    it('should throw NotFoundException when page not found', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(
        service.update(TEST_IDS.PAGE_1, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new path conflicts', async () => {
      const existingPage = createMockPage({ path: '/old-path' });
      repo.findById.mockResolvedValue(existingPage);
      repo.existsByPath.mockResolvedValue(true);

      await expect(
        service.update(TEST_IDS.PAGE_1, { path: '/existing-path' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should soft-delete page via repository', async () => {
      repo.softDelete.mockResolvedValue(undefined);

      await service.delete(TEST_IDS.PAGE_1);

      expect(repo.softDelete).toHaveBeenCalledWith(TEST_IDS.PAGE_1);
    });
  });

  describe('initializeDefaultPages', () => {
    it('should create 3 default pages', async () => {
      // No existing pages
      repo.findByPath.mockResolvedValue(null);
      repo.create.mockResolvedValue(createMockPage());

      await service.initializeDefaultPages();

      expect(repo.create).toHaveBeenCalledTimes(3);
    });

    it('should skip existing pages', async () => {
      // All pages already exist
      repo.findByPath.mockResolvedValue(createMockPage());

      await service.initializeDefaultPages();

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should migrate privacy page scripts when custom_js is empty', async () => {
      // Privacy page exists with empty customJs
      const existingPrivacy = createMockPage({
        path: '/privacy',
        customJs: '',
        markdownContent: '<p>text</p><script>code</script>',
        content: '<p>text</p><script>code</script>',
      });
      repo.findByPath.mockImplementation((path: string) => {
        if (path === '/privacy') return Promise.resolve(existingPrivacy);
        if (path === '/cookies') return Promise.resolve(createMockPage({ path: '/cookies' }));
        if (path === '/copyright') return Promise.resolve(createMockPage({ path: '/copyright' }));
        return Promise.resolve(null);
      });
      repo.update.mockResolvedValue(createMockPage());

      await service.initializeDefaultPages();

      expect(repo.update).toHaveBeenCalled();
    });
  });
});
