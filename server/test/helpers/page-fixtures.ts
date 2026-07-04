/**
 * Test fixtures and mock factories for Page module tests.
 */

export const TEST_IDS = {
  PAGE_1: 1,
  PAGE_2: 2,
  PAGE_3: 3,
  NONEXISTENT: 999,
} as const;

export function createMockPage(overrides: Record<string, any> = {}) {
  return {
    id: TEST_IDS.PAGE_1,
    title: 'Test Page',
    path: '/test-page',
    content: '<p>Test content</p>',
    markdownContent: '# Test Page\n\nTest content',
    customJs: '',
    customCss: '',
    description: 'A test page',
    isPublished: true,
    showComment: false,
    sort: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

export function createMockCreatePageDto(overrides: Record<string, any> = {}) {
  return {
    title: 'New Page',
    path: '/new-page',
    content: '<p>New page content</p>',
    markdownContent: '# New Page\n\nNew page content',
    customJs: '',
    customCss: '',
    description: 'A new page',
    isPublished: true,
    showComment: false,
    sort: 0,
    ...overrides,
  };
}

export function createMockUpdatePageDto(overrides: Record<string, any> = {}) {
  return {
    title: 'Updated Page',
    path: '/updated-page',
    content: '<p>Updated content</p>',
    ...overrides,
  };
}

/**
 * Creates a mock Drizzle database instance with vi.fn() for each query method.
 * Each method returns a configurable chainable object.
 */
export function createMockDb() {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
  };

  const db = {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    _chain: mockChain,
  };

  return db;
}
