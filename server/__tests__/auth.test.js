const request = require('supertest');
const { app, prisma, redis, scraperService } = require('../index');
const { cleanupDatabase, generateUniqueData } = require('./testHelpers');

describe('Authentication Endpoints', () => {
  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
    await scraperService.cleanup();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = generateUniqueData('register');
      userData.password = 'password123';

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (response.status !== 201) {
        console.log('Registration failed:', response.body);
      }

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return error for duplicate email', async () => {
      // First, create a user
      const userData1 = generateUniqueData('duplicate1');
      userData1.password = 'password123';

      const response1 = await request(app)
        .post('/api/auth/register')
        .send(userData1);

      if (response1.status !== 201) {
        console.log('First registration failed:', response1.body);
      }

      expect(response1.status).toBe(201);

      // Then try to create another user with the same email
      const userData2 = generateUniqueData('duplicate2');
      userData2.email = userData1.email; // Use the same email
      userData2.password = 'password123';

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData2)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should return error for invalid email', async () => {
      const userData = generateUniqueData('invalid');
      userData.email = 'invalid-email';
      userData.password = 'password123';

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });

    it('should return error for short password', async () => {
      const userData = generateUniqueData('shortpass');
      userData.password = '123';

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('errors');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      // First register a user
      const userData = generateUniqueData('login');
      userData.password = 'password123';

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (registerResponse.status !== 201) {
        console.log('Registration failed for login test:', registerResponse.body);
      }

      expect(registerResponse.status).toBe(201);

      // Then login with the same credentials
      const loginData = {
        email: userData.email,
        password: userData.password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(loginData.email);
    });

    it('should return error for invalid email', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('should return error for invalid password', async () => {
      // First register a user
      const userData = generateUniqueData('wrongpass');
      userData.password = 'password123';

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      if (registerResponse.status !== 201) {
        console.log('Registration failed for wrong password test:', registerResponse.body);
      }

      expect(registerResponse.status).toBe(201);

      // Then try to login with wrong password
      const loginData = {
        email: userData.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid email or password');
    });
  });
});
