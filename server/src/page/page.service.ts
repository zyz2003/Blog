import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PageRepository } from './page.repository';
import { ErrorCodes } from '../common/constants/error-codes';
import { toISODateString } from '../common/utils/time.util';

/**
 * Normalize a page path to match Go backend normalizePath behavior.
 * Per D-76: trim whitespace, ensure / prefix, strip trailing / (except root).
 */
export function normalizePath(path: string): string {
  // Trim whitespace
  const trimmed = path.trim();
  // Empty/whitespace-only → empty string
  if (!trimmed) return '';
  // Ensure leading /
  let normalized = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
  // Strip trailing / except for root path "/"
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Split content and extract script tags into customJs field.
 * Per D-83: replicates Go splitContentAndCustomJS with (?is) flags.
 * JS equivalent: /<script[^>]*>([\s\S]*?)<\/script>/gi
 */
export function splitContentAndCustomJS(content: string): {
  content: string;
  customJs: string;
} {
  if (!content) return { content: '', customJs: '' };

  const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(content)) !== null) {
    const scriptContent = match[1].trim();
    if (scriptContent) {
      scripts.push(scriptContent);
    }
  }

  // Remove all script tags from content
  const cleanContent = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();

  return {
    content: cleanContent,
    customJs: scripts.join('\n\n'),
  };
}

@Injectable()
export class PageService {
  constructor(private readonly repo: PageRepository) {}

  /**
   * Validate page path per D-79.
   * Checks: empty, no leading /, spaces, special characters.
   */
  validatePath(path: string): void {
    if (!path) {
      throw new BadRequestException(ErrorCodes.PAGE_PATH_EMPTY);
    }
    if (!path.startsWith('/')) {
      throw new BadRequestException(ErrorCodes.PAGE_PATH_NO_SLASH);
    }
    if (/\s/.test(path)) {
      throw new BadRequestException(ErrorCodes.PAGE_PATH_HAS_SPACE);
    }
    // Special characters: < > " ' & ? # = + ;
    if (/[<>"'&?#=+;]/.test(path)) {
      throw new BadRequestException(ErrorCodes.PAGE_PATH_INVALID_CHAR);
    }
  }

  /**
   * Create a new page. Per D-77: title, path, content are required.
   */
  async create(options: any) {
    // Normalize and validate path
    const normalizedPath = normalizePath(options.path);
    this.validatePath(normalizedPath);

    // Check path uniqueness per D-80
    const exists = await this.repo.existsByPath(normalizedPath);
    if (exists) {
      throw new ConflictException(ErrorCodes.PAGE_PATH_EXISTS);
    }

    // Create page
    const page = await this.repo.create({
      title: options.title,
      path: normalizedPath,
      content: options.content,
      markdownContent: options.markdown_content ?? '',
      customJs: options.custom_js ?? '',
      customCss: options.custom_css ?? '',
      description: options.description ?? null,
      isPublished: options.is_published ?? true,
      showComment: options.show_comment ?? false,
      sort: options.sort ?? 0,
    });

    return this.toApiResponse(page);
  }

  /**
   * Get page by numeric ID. Per D-71: Page uses raw numeric ID.
   */
  async getById(id: number) {
    const page = await this.repo.findById(id);
    if (!page) {
      throw new NotFoundException(ErrorCodes.PAGE_NOT_FOUND);
    }
    return this.toApiResponse(page);
  }

  /**
   * Get page by path. Per D-72: public endpoint uses path routing.
   * Per D-76: includes trailing-slash fallback for historical data.
   */
  async getByPath(path: string) {
    const normalizedPath = normalizePath(path);
    let page = await this.repo.findByPath(normalizedPath);

    // Trailing-slash fallback per D-76
    if (!page && normalizedPath !== '/') {
      page = await this.repo.findByPath(normalizedPath + '/');
    }

    if (!page) {
      throw new NotFoundException(ErrorCodes.PAGE_NOT_FOUND);
    }
    return this.toApiResponse(page);
  }

  /**
   * List pages. Per D-73: returns { pages, total, page, size } format.
   */
  async list(options: { page: number; pageSize: number; search?: string; isPublished?: boolean }) {
    const result = await this.repo.list(options);
    return {
      pages: result.list.map((p: any) => this.toApiResponse(p)),
      total: result.total,
      page: options.page,
      size: options.pageSize,
    };
  }

  /**
   * Update page. Per D-78: all fields optional (pointer type).
   */
  async update(id: number, options: any) {
    // Verify page exists
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException(ErrorCodes.PAGE_NOT_FOUND);
    }

    const data: any = {};

    if (options.title !== undefined) data.title = options.title;
    if (options.content !== undefined) data.content = options.content;
    if (options.markdown_content !== undefined) data.markdownContent = options.markdown_content;
    if (options.custom_js !== undefined) data.customJs = options.custom_js;
    if (options.custom_css !== undefined) data.customCss = options.custom_css;
    if (options.description !== undefined) data.description = options.description;
    if (options.is_published !== undefined) data.isPublished = options.is_published;
    if (options.show_comment !== undefined) data.showComment = options.show_comment;
    if (options.sort !== undefined) data.sort = options.sort;

    // Handle path change per D-80
    if (options.path !== undefined) {
      const normalizedPath = normalizePath(options.path);
      this.validatePath(normalizedPath);
      // Check uniqueness only if path actually changed
      if (normalizedPath !== existing.path) {
        const exists = await this.repo.existsByPath(normalizedPath, id);
        if (exists) {
          throw new ConflictException(ErrorCodes.PAGE_PATH_EXISTS);
        }
      }
      data.path = normalizedPath;
    }

    const updated = await this.repo.update(id, data);
    return this.toApiResponse(updated);
  }

  /**
   * Soft-delete page. Per D-81: uses deletedAt field.
   */
  async delete(id: number) {
    await this.repo.softDelete(id);
  }

  /**
   * Initialize default pages. Per D-82: creates 3 default pages.
   * Per D-84: idempotent — skips existing pages.
   * Per D-85: migrates privacy page scripts when custom_js is empty.
   */
  async initializeDefaultPages() {
    const defaultPages = [
      {
        path: '/privacy',
        title: '隐私政策',
        content: `<p>本隐私政策旨在帮助您了解我们会收集哪些信息、为什么收集这些信息，以及您如何更新、管理和导出您的信息。</p>`,
        markdownContent: `本隐私政策旨在帮助您了解我们会收集哪些信息、为什么收集这些信息，以及您如何更新、管理和导出您的信息。`,
        customJs: '',
        customCss: '',
        description: '隐私政策',
        isPublished: true,
        showComment: false,
        sort: 0,
      },
      {
        path: '/cookies',
        title: 'Cookie 政策',
        content: `<p>本 Cookie 政策解释了什么是 Cookie，我们如何使用它们，以及您如何管理您的 Cookie 偏好。</p>`,
        markdownContent: `本 Cookie 政策解释了什么是 Cookie，我们如何使用它们，以及您如何管理您的 Cookie 偏好。`,
        customJs: '',
        customCss: '',
        description: 'Cookie 政策',
        isPublished: true,
        showComment: false,
        sort: 0,
      },
      {
        path: '/copyright',
        title: '版权声明',
        content: `<p>本站所有原创内容均受版权法保护。未经授权，禁止转载、摘编或以其他方式使用。</p>`,
        markdownContent: `本站所有原创内容均受版权法保护。未经授权，禁止转载、摘编或以其他方式使用。`,
        customJs: '',
        customCss: '',
        description: '版权声明',
        isPublished: true,
        showComment: false,
        sort: 0,
      },
    ];

    // Process privacy page: extract scripts per D-83
    const privacyPage = defaultPages[0];
    const fromMarkdown = splitContentAndCustomJS(privacyPage.markdownContent);
    const fromContent = splitContentAndCustomJS(privacyPage.content);
    // Priority: markdown scripts first, content scripts as fallback per D-83
    privacyPage.customJs = fromMarkdown.customJs || fromContent.customJs;
    privacyPage.content = fromMarkdown.customJs ? fromMarkdown.content : fromContent.content;

    // Create or skip each default page per D-84
    for (const defaultPage of defaultPages) {
      const existing = await this.repo.findByPath(defaultPage.path);

      if (existing) {
        // D-85: migrate privacy page scripts if custom_js is empty
        if (defaultPage.path === '/privacy' && !existing.customJs) {
          const mdResult = splitContentAndCustomJS(existing.markdownContent || '');
          const contentResult = splitContentAndCustomJS(existing.content || '');
          const extractedJs = mdResult.customJs || contentResult.customJs;
          if (extractedJs) {
            await this.repo.update(existing.id, {
              customJs: extractedJs,
              content: mdResult.customJs ? mdResult.content : contentResult.content,
            });
          }
        }
        continue; // Skip existing pages per D-84
      }

      // Create new default page
      await this.repo.create(defaultPage);
    }
  }

  /**
   * Map page DB row to Go-compatible API response.
   * Per D-71: Page uses raw numeric ID (no Sqids encoding).
   * Per D-73: Response uses snake_case field names.
   */
  toApiResponse(page: any) {
    if (!page) return null;
    return {
      id: page.id,
      title: page.title,
      path: page.path,
      content: page.content ?? null,
      markdown_content: page.markdownContent ?? '',
      custom_js: page.customJs ?? '',
      custom_css: page.customCss ?? '',
      description: page.description ?? null,
      is_published: page.isPublished ?? true,
      show_comment: page.showComment ?? false,
      sort: page.sort ?? 0,
      created_at: toISODateString(page.createdAt),
      updated_at: toISODateString(page.updatedAt),
    };
  }
}
