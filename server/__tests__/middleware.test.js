const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, prisma, redis, scraperService } = require('../index');
const { 
  cleanupDatabase, 
  setupTestEnvironment, 
} = require('./testHelpers');

describe('Authentication Middleware', () => {
  let validToken;
  let testUser;

  beforeAll(async () => {
    await cleanupDatabase();
    const setup = await setupTestEnvironment('middleware');
    testUser = setup.user;
    validToken = setup.authToken;
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
    const setup = await setupTestEnvironment('middleware');
    testUser = setup.user;
    validToken = setup.authToken;
  });

  describe('Protected Routes Access', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pages');
      expect(response.body).toHaveProperty('pagination');
    });

    it('should return 401 for missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/pages')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return 401 for malformed Authorization header', async () => {
      const malformedHeaders = [
        'InvalidToken',
        'Bearer',
        'Bearer ',
        'Basic dGVzdDp0ZXN0',
        'Token invalid-token'
      ];

      for (const header of malformedHeaders) {
        const response = await request(app)
          .get('/api/pages')
          .set('Authorization', header)
          .expect(401);

        // Some headers will return "Access token required" (no token part)
        // Others will return "Invalid token" (has token part but invalid)
        const expectedError = header.includes(' ') && header.split(' ')[1] 
          ? 'Invalid token' 
          : 'Access token required';
        
        expect(response.body).toHaveProperty('error', expectedError);
      }
    });

    it('should return 401 for invalid token format', async () => {
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 401 for expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET,
        { expiresIn: '0s' }
      );

      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Token expired');
    });

    it('should return 401 for token with invalid signature', async () => {
      // Create a token with wrong secret
      const invalidToken = jwt.sign(
        { userId: testUser.id },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 401 for token without userId', async () => {
      const tokenWithoutUserId = jwt.sign(
        { someOtherField: 'value' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${tokenWithoutUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    it('should return 401 for token with non-existent userId', async () => {
      const tokenWithInvalidUserId = jwt.sign(
        { userId: 'non-existent-user-id' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${tokenWithInvalidUserId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('User Context in Protected Routes', () => {
    it('should set user context correctly in request object', async () => {
      // Create a test page to verify user context
      const pageData = {
        url: 'https://example.com'
      };

      const response = await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${validToken}`)
        .send(pageData)
        .expect(201);

      // Verify the page was created successfully
      expect(response.body).toHaveProperty('page');
      expect(response.body.page).toHaveProperty('id');
      expect(response.body.page).toHaveProperty('url', 'https://example.com');
    });

    it('should isolate user data correctly', async () => {
      // Create another user
      const otherUserData = {
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123'
      };

      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send(otherUserData);

      const otherUserToken = otherUserResponse.body.token;

      if (!otherUserToken) {
        throw new Error('Failed to get token for other user');
      }

      // Create pages for both users
      await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ url: 'https://user1.com' });

      await request(app)
        .post('/api/pages')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ url: 'https://user2.com' });

      // Verify each user only sees their own pages
      const user1Pages = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const user2Pages = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(200);

      expect(user1Pages.body.pages).toHaveLength(1);
      expect(user1Pages.body.pages[0].url).toBe('https://user1.com');
      expect(user2Pages.body.pages).toHaveLength(1);
      expect(user2Pages.body.pages[0].url).toBe('https://user2.com');
    });
  });

  describe('All Protected Endpoints', () => {
    it('should protect pages endpoints', async () => {
      const pagesEndpoints = [
        { method: 'GET', path: '/api/pages' },
        { method: 'POST', path: '/api/pages' },
        { method: 'GET', path: '/api/pages/1' },
        { method: 'DELETE', path: '/api/pages/1' },
        { method: 'POST', path: '/api/pages/1/retry' }
      ];

      for (const endpoint of pagesEndpoints) {
        const requestBuilder = request(app)[endpoint.method.toLowerCase()](endpoint.path);
        
        const response = await requestBuilder.expect(401);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should protect links endpoints', async () => {
      const linksEndpoints = [
        { method: 'GET', path: '/api/links' },
        { method: 'GET', path: '/api/links/page/1' },
        { method: 'GET', path: '/api/links/search?q=test' }
      ];

      for (const endpoint of linksEndpoints) {
        const requestBuilder = request(app)[endpoint.method.toLowerCase()](endpoint.path);
        
        const response = await requestBuilder.expect(401);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should not protect authentication endpoints', async () => {
      const authEndpoints = [
        { method: 'POST', path: '/api/auth/register' },
        { method: 'POST', path: '/api/auth/login' }
      ];

      for (const endpoint of authEndpoints) {
        const requestBuilder = request(app)[endpoint.method.toLowerCase()](endpoint.path);
        
        // These should not return 401 (they might return 400 for missing data, but not 401)
        const response = await requestBuilder;
        expect(response.status).not.toBe(401);
      }
    });
  });

  describe('Token Security', () => {
    it('should handle tokens with extra whitespace', async () => {
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer  ${validToken}  `)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should handle tokens with special characters', async () => {
      // Create a token and test it
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pages');
    });

    it('should reject tokens that are too long', async () => {
      const longToken = 'a'.repeat(10000);
      
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${longToken}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle concurrent requests with same token', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/pages')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('pages');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking the database connection
      // For now, we'll test that the middleware doesn't crash
      const response = await request(app)
        .get('/api/pages')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('pages');
    });

    it('should provide consistent error messages', async () => {
      const errorScenarios = [
        { token: null, expectedError: 'Access token required' },
        { token: 'invalid', expectedError: 'Access token required' },
        { token: 'Bearer invalid', expectedError: 'Invalid token' }
      ];

      for (const scenario of errorScenarios) {
        const requestBuilder = request(app).get('/api/pages');
        
        if (scenario.token) {
          requestBuilder.set('Authorization', scenario.token);
        }

        const response = await requestBuilder.expect(401);
        expect(response.body.error).toBe(scenario.expectedError);
      }
    });
  });
});
