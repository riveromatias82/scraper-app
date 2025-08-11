// Test configuration constants
const TEST_CONFIG = {
  // Database settings
  DATABASE_URL: 'file:./test.db',
  JWT_SECRET: 'test-secret-key',
  
  // Test data defaults
  DEFAULT_PASSWORD: 'password123',
  DEFAULT_LINK_COUNT: 5,
  
  // Test timeouts
  TEST_TIMEOUT: 30000,
  SETUP_TIMEOUT: 60000,
  
  // Pagination defaults
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  
  // Mock server settings
  MOCK_SERVER_DELAY: 100,
  
  // Test user prefixes
  USER_PREFIXES: {
    AUTH: 'auth',
    PAGES: 'pages',
    LINKS: 'links',
    MIDDLEWARE: 'middleware',
    DB: 'db',
    SCRAPER: 'scraper'
  }
};

// Test data generators
const TEST_DATA = {
  generateUniqueEmail: (prefix) => `${prefix}_${Date.now()}@example.com`,
  generateUniqueUsername: (prefix) => `${prefix}_${Date.now()}`,
  generateUniqueUrl: (prefix) => `https://${prefix}_${Date.now()}.com`,
  
  // Standard test user data
  createUserData: (prefix) => ({
    username: TEST_DATA.generateUniqueUsername(prefix),
    email: TEST_DATA.generateUniqueEmail(prefix),
    password: TEST_CONFIG.DEFAULT_PASSWORD
  }),
  
  // Standard test page data
  createPageData: (userId, overrides = {}) => ({
    url: TEST_DATA.generateUniqueUrl('page'),
    title: 'Test Page',
    status: 'COMPLETED',
    linkCount: TEST_CONFIG.DEFAULT_LINK_COUNT,
    userId,
    ...overrides
  }),
  
  // Standard test link data
  createLinkData: (pageId, index = 0, overrides = {}) => ({
    url: `https://link${index}.com`,
    name: `Link ${index}`,
    isExternal: false,
    pageId,
    ...overrides
  })
};

// Test utilities
const TEST_UTILS = {
  // Wait for a specified time (useful for async operations)
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Generate random string
  randomString: (length = 8) => Math.random().toString(36).substring(2, length + 2),
  
  // Generate random number
  randomNumber: (min = 1, max = 1000) => Math.floor(Math.random() * (max - min + 1)) + min,
  
  // Create array of test data
  createArray: (length, generator) => Array.from({ length }, (_, i) => generator(i)),
  
  // Validate pagination response
  validatePagination: (response, expectedItems, page = 1, limit = TEST_CONFIG.DEFAULT_PAGE_SIZE) => {
    expect(response.body).toHaveProperty('pagination');
    expect(response.body.pagination.currentPage).toBe(page);
    expect(response.body.pagination.totalItems).toBe(expectedItems);
    expect(response.body.pagination.limit).toBe(limit);
  }
};

module.exports = {
  TEST_CONFIG,
  TEST_DATA,
  TEST_UTILS
};
