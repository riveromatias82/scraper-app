const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { TEST_CONFIG, TEST_DATA, TEST_UTILS } = require('./testConfig');

// Create a shared Prisma instance for tests
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || TEST_CONFIG.DATABASE_URL
    }
  },
  log: ['error'],
  errorFormat: 'minimal'
});

/**
 * Clean up all test data from database
 */
const cleanupDatabase = async () => {
  try {
    // Delete in correct order to avoid foreign key constraints
    await prisma.link.deleteMany();
    await prisma.page.deleteMany();
    await prisma.user.deleteMany();
  } catch (error) {
    // If tables don't exist, that's okay - they'll be created when needed
    console.warn('Database tables may not exist yet:', error.message);
  }
};

/**
 * Create a test user with unique data
 */
const createTestUser = async (prefix = 'testuser') => {
  const userData = TEST_DATA.createUserData(prefix);
  const hashedPassword = await bcrypt.hash(userData.password, 12);
  
  const user = await prisma.user.create({
    data: {
      username: userData.username,
      email: userData.email,
      password: hashedPassword
    },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true
    }
  });

  return { user, userData };
};

/**
 * Generate JWT token for a user
 */
const generateAuthToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || TEST_CONFIG.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Create a test page for a user
 */
const createTestPage = async (userId, pageData = {}) => {
  const defaultData = TEST_DATA.createPageData(userId);
  return await prisma.page.create({
    data: { ...defaultData, ...pageData }
  });
};

/**
 * Create test links for a page
 */
const createTestLinks = async (pageId, count = TEST_CONFIG.DEFAULT_LINK_COUNT) => {
  const links = TEST_UTILS.createArray(count, (i) => 
    TEST_DATA.createLinkData(pageId, i)
  );
  return await prisma.link.createMany({ data: links });
};

/**
 * Setup test environment with user and token
 */
const setupTestEnvironment = async (prefix = 'testuser') => {
  const { user, userData } = await createTestUser(prefix);
  const authToken = generateAuthToken(user.id);
  
  return { user, userData, authToken };
};

/**
 * Generate unique test data with timestamp
 */
const generateUniqueData = (prefix) => {
  return {
    username: TEST_DATA.generateUniqueUsername(prefix),
    email: TEST_DATA.generateUniqueEmail(prefix),
    url: TEST_DATA.generateUniqueUrl(prefix)
  };
};

/**
 * Create multiple test pages for a user
 */
const createMultipleTestPages = async (userId, count, overrides = {}) => {
  const pages = [];
  for (let i = 0; i < count; i++) {
    const page = await createTestPage(userId, {
      url: `https://example${i}.com`,
      title: `Example ${i}`,
      ...overrides
    });
    pages.push(page);
  }
  return pages;
};

/**
 * Create a complete test scenario with user, pages, and links
 */
const createTestScenario = async (prefix = 'test') => {
  const { user, authToken } = await setupTestEnvironment(prefix);
  const page = await createTestPage(user.id);
  const links = await createTestLinks(page.id);
  
  return { user, authToken, page, links };
};

module.exports = {
  prisma,
  cleanupDatabase,
  createTestUser,
  generateAuthToken,
  createTestPage,
  createTestLinks,
  setupTestEnvironment,
  generateUniqueData,
  createMultipleTestPages,
  createTestScenario
};
