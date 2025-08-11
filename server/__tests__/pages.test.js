const request = require('supertest');
const { app, prisma, redis, scraperService } = require('../index');
const { 
  cleanupDatabase, 
  setupTestEnvironment, 
  createTestPage, 
  createTestUser 
} = require('./testHelpers');

describe('Pages Endpoints', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    await cleanupDatabase();
    const setup = await setupTestEnvironment('pages');
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
    
    // Recreate test user for each test
    const setup = await setupTestEnvironment('pages');
    testUser = setup.user;
    authToken = setup.authToken;
  });

  describe('GET /api/pages', () => {
    it('should get pages with pagination for authenticated user', async () => {
      // Create test pages
      const page1 = await createTestPage(testUser.id, {
        url: 'https://example1.com',
        title: 'Example 1'
      });
      
      const page2 = await createTestPage(testUser.id, {
        url: 'https://example2.com',
        title: 'Example 2',
        status: 'PENDING',
        linkCount: 0
      });

      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pages');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pages).toHaveLength(2);
      expect(response.body.pagination.currentPage).toBe(1);
      expect(response.body.pagination.totalItems).toBe(2);
    });

    it('should handle pagination parameters correctly', async () => {
      // Create 15 test pages
      for (let i = 0; i < 15; i++) {
        await createTestPage(testUser.id, {
          url: `https://example${i}.com`,
          title: `Example ${i}`,
          linkCount: i
        });
      }

      const response = await request(app)
        .get('/api/pages?page=2&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pages).toHaveLength(5);
      expect(response.body.pagination.currentPage).toBe(2);
      expect(response.body.pagination.totalPages).toBe(3);
      expect(response.body.pagination.hasNextPage).toBe(true);
      expect(response.body.pagination.hasPrevPage).toBe(true);
    });

    it('should return empty array when user has no pages', async () => {
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pages).toHaveLength(0);
      expect(response.body.pagination.totalItems).toBe(0);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/pages')
        .expect(401);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/pages?page=0&limit=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/pages', () => {
    it('should create a new page for scraping', async () => {
      const pageData = {
        url: 'https://example.com'
      };

      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${authToken}`)
        .send(pageData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Page scraping started');
      expect(response.body).toHaveProperty('page');
      expect(response.body.page.url).toBe(pageData.url);
      expect(response.body.page.status).toBe('PENDING');
      expect(response.body.page).toHaveProperty('id');
      expect(response.body.page).toHaveProperty('url', pageData.url);
              expect(response.body.page).toHaveProperty('status', 'PENDING');
    });

    it('should validate URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com',
        'javascript:alert("test")',
        ''
      ];

      for (const url of invalidUrls) {
        const response = await request(app)
          .post('/api/pages')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ url })
          .expect(400);

        expect(response.body).toHaveProperty('errors');
      }
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/pages')
        .send({ url: 'https://example.com' })
        .expect(401);
    });

    it('should handle missing URL', async () => {
      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/pages/:id', () => {
    let testPage;

    beforeEach(async () => {
      testPage = await createTestPage(testUser.id, {
        url: 'https://example.com',
        title: 'Example Page',
        linkCount: 10
      });
    });

    it('should get specific page details', async () => {
      const response = await request(app)
        .get(`/api/pages/${testPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.page).toHaveProperty('id', testPage.id);
      expect(response.body.page).toHaveProperty('url', testPage.url);
      expect(response.body.page).toHaveProperty('title', testPage.title);
    });

    it('should return 404 for non-existent page', async () => {
      const response = await request(app)
        .get('/api/pages/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Page not found');
    });

    it('should return 404 for page belonging to different user', async () => {
      // Create another user and page
      const { user: otherUser } = await createTestUser('otheruser');
      const otherPage = await createTestPage(otherUser.id, {
        url: 'https://other.com',
        title: 'Other Page'
      });

      const response = await request(app)
        .get(`/api/pages/${otherPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Page not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/api/pages/${testPage.id}`)
        .expect(401);
    });
  });

  describe('DELETE /api/pages/:id', () => {
    let testPage;

    beforeEach(async () => {
      testPage = await createTestPage(testUser.id, {
        url: 'https://example.com',
        title: 'Example Page',
        linkCount: 10
      });
    });

    it('should delete page and associated links', async () => {
      // Create some links for the page
      await prisma.link.createMany({
        data: [
          { url: 'https://link1.com', name: 'Link 1', isExternal: false, pageId: testPage.id },
          { url: 'https://link2.com', name: 'Link 2', isExternal: true, pageId: testPage.id }
        ]
      });

      const response = await request(app)
        .delete(`/api/pages/${testPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Page deleted successfully');

      // Verify page and links are deleted
      const deletedPage = await prisma.page.findUnique({
        where: { id: testPage.id }
      });
      expect(deletedPage).toBeNull();

      const remainingLinks = await prisma.link.findMany({
        where: { pageId: testPage.id }
      });
      expect(remainingLinks).toHaveLength(0);
    });

    it('should return 404 for non-existent page', async () => {
      const response = await request(app)
        .delete('/api/pages/999999')
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
        .delete(`/api/pages/${otherPage.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Page not found');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .delete(`/api/pages/${testPage.id}`)
        .expect(401);
    });
  });

  describe('POST /api/pages/:id/retry', () => {
    let retryTestPage;

    beforeEach(async () => {
      retryTestPage = await createTestPage(testUser.id, {
        url: 'https://example.com',
        title: 'Example Page',
        status: 'FAILED',
        linkCount: 0
      });
    });

    it('should retry failed scraping job', async () => {
      const response = await request(app)
        .post(`/api/pages/${retryTestPage.id}/retry`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Page scraping restarted');
    });

    it('should return 404 for non-existent page', async () => {
      const response = await request(app)
        .post('/api/pages/999999/retry')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Page not found');
    });

    it('should return 400 for page that is not failed', async () => {
      // Update page to completed status
      await prisma.page.update({
        where: { id: retryTestPage.id },
        data: { status: 'COMPLETED' }
      });

      const response = await request(app)
        .post(`/api/pages/${retryTestPage.id}/retry`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Only failed pages can be retried');
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .post(`/api/pages/${retryTestPage.id}/retry`)
        .expect(401);
    });
  });
});
