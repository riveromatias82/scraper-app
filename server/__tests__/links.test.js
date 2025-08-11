const request = require('supertest');
const { app, prisma, redis, scraperService } = require('../index');
const { 
  cleanupDatabase, 
  setupTestEnvironment, 
  createTestPage, 
  createTestLinks,
  createTestUser 
} = require('./testHelpers');

describe('Links Endpoints', () => {
  let authToken;
  let testUser;
  let testPage;

  beforeAll(async () => {
    await cleanupDatabase();
    const setup = await setupTestEnvironment('links');
    testUser = setup.user;
    authToken = setup.authToken;
  });

  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
    await redis.quit();
    await scraperService.cleanup();
  });

  beforeEach(async () => {
    await cleanupDatabase();
    
    // Recreate test user and page for each test
    const setup = await setupTestEnvironment('links');
    testUser = setup.user;
    authToken = setup.authToken;
    
    testPage = await createTestPage(testUser.id);
    await createTestLinks(testPage.id, 5);
  });

  describe('GET /api/links/page/:pageId', () => {
    it('should get links for specific page with pagination', async () => {
      const response = await request(app)
        .get(`/api/links/page/${testPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('links');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.links).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalItems).toBe(5);
    });

    it('should handle pagination parameters correctly', async () => {
      // Create more links for pagination testing
      await createTestLinks(testPage.id, 15);

      const response = await request(app)
        .get(`/api/links/page/${testPage.id}?page=2&limit=5`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(2);
      expect(response.body.pagination.totalPages).toBe(4);
      expect(response.body.pagination.hasNextPage).toBe(true);
      expect(response.body.pagination.hasPrevPage).toBe(true);
    });

    it('should return 404 for non-existent page', async () => {
      const response = await request(app)
        .get('/api/links/page/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Page not found');
    });

    it('should return 404 for page belonging to different user', async () => {
      const { user: otherUser } = await createTestUser('otheruser');
      const otherPage = await createTestPage(otherUser.id, {
        url: 'https://other.com',
        title: 'Other Page'
      });

      const response = await request(app)
        .get(`/api/links/page/${otherPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Page not found');
    });

    it('should return empty array when page has no links', async () => {
      // Create a page without links
      const emptyPage = await createTestPage(testUser.id, {
        url: 'https://empty.com',
        title: 'Empty Page',
        linkCount: 0
      });

      const response = await request(app)
        .get(`/api/links/page/${emptyPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(0);
      expect(response.body.pagination.totalItems).toBe(0);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/api/links/page/${testPage.id}`)
        .expect(401);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/links/page/${testPage.id}?page=0&limit=0`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/links', () => {
    it('should get all links for authenticated user with pagination', async () => {
      const response = await request(app)
        .get('/api/links')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('links');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.links).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalItems).toBe(5);
    });

    it('should handle pagination parameters correctly', async () => {
      // Create more links for pagination testing
      await createTestLinks(testPage.id, 15);

      const response = await request(app)
        .get('/api/links?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(2);
      expect(response.body.pagination.totalPages).toBe(4);
      expect(response.body.pagination.hasNextPage).toBe(true);
      expect(response.body.pagination.hasPrevPage).toBe(true);
    });

    it('should return empty array when user has no links', async () => {
      // Delete all links
      await prisma.link.deleteMany();

      const response = await request(app)
        .get('/api/links')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(0);
      expect(response.body.pagination.totalItems).toBe(0);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/links')
        .expect(401);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/links?page=0&limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/links/search', () => {
    it('should search links by name', async () => {
      const response = await request(app)
        .get('/api/links/search?q=Link')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('links');
      expect(response.body.links).toHaveLength(5);
      expect(response.body.links[0].name).toContain('Link');
    });

    it('should search links by URL', async () => {
      const response = await request(app)
        .get('/api/links/search?q=link1.com')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('links');
      expect(response.body.links).toHaveLength(1);
      expect(response.body.links[0].url).toBe('https://link1.com');
    });

    it('should search links case-insensitively', async () => {
      const response = await request(app)
        .get('/api/links/search?q=LINK')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(5);
      expect(response.body.links[0].name).toContain('Link');
    });

    it('should return multiple results for partial matches', async () => {
      const response = await request(app)
        .get('/api/links/search?q=Link')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links.length).toBeGreaterThan(1);
      expect(response.body.links.every(link => 
        link.name.toLowerCase().includes('link') || 
        link.url.toLowerCase().includes('link')
      )).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/links/search?q=nonexistent')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(0);
    });

    it('should handle pagination with search results', async () => {
      // Create more links with similar names for pagination testing
      await createTestLinks(testPage.id, 15);

      const response = await request(app)
        .get('/api/links/search?q=Link&page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.links).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(2);
      expect(response.body.pagination.hasNextPage).toBe(true);
    });

    it('should return 400 for missing search query', async () => {
      const response = await request(app)
        .get('/api/links/search')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Search query is required');
    });

    it('should return 400 for empty search query', async () => {
      const response = await request(app)
        .get('/api/links/search?q=')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Search query is required');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/links/search?q=test')
        .expect(401);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/links/search?q=test&page=0&limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('Cross-user data isolation', () => {
    it('should not return links from other users', async () => {
      // Create another user with their own page and links
      const { user: otherUser } = await createTestUser('otheruser');
      const otherPage = await createTestPage(otherUser.id, {
        url: 'https://other.com',
        title: 'Other Page'
      });

      await createTestLinks(otherPage.id, 2);

      // Search for links - should only return current user's links
      const response = await request(app)
        .get('/api/links/search?q=Link')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should not contain other user's links
      const otherUserLinks = response.body.links.filter(link => 
        link.url.includes('otherlink')
      );
      expect(otherUserLinks).toHaveLength(0);
    });
  });
});
