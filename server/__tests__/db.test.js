const { prisma, cleanupDatabase, createTestUser, createTestPage } = require('./testHelpers');

describe('Database Connection Test', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'file:./test.db';
    process.env.JWT_SECRET = 'test-secret-key';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('should connect to database and create a user', async () => {
    // Test database connection
    await expect(prisma.$connect()).resolves.not.toThrow();
    
    // Test user creation with unique data
    const { user } = await createTestUser('db-test');

    expect(user).toBeDefined();
    expect(user.username).toContain('db-test');
    expect(user.email).toContain('db-test');
    expect(user.id).toBeDefined();
  });

  it('should create a page and link', async () => {
    // Create user first
    const { user } = await createTestUser('db-page-test');

    // Create page
    const page = await createTestPage(user.id, {
      url: 'https://example.com',
      title: 'Test Page'
    });

    expect(page).toBeDefined();
    expect(page.url).toBe('https://example.com');

    // Create link
    const link = await prisma.link.create({
      data: {
        url: 'https://link.com',
        name: 'Test Link',
        isExternal: false,
        pageId: page.id
      }
    });

    expect(link).toBeDefined();
    expect(link.url).toBe('https://link.com');
    expect(link.name).toBe('Test Link');
  });
});
