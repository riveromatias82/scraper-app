// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'file:./test.db';
process.env.REDIS_URL = 'redis://localhost:6379';

// Increase timeout for tests
jest.setTimeout(60000);

// Import mock server and test helpers
const { startMockServer, stopMockServer } = require('./mockServer');
const { cleanupDatabase, prisma } = require('./testHelpers');

// Global variables for mock server
global.mockServerPort = null;

// Helper function to get mock URLs for tests
global.getMockUrl = (path = '') => {
  if (!global.mockServerPort) {
    throw new Error('Mock server not started');
  }
  return `http://localhost:${global.mockServerPort}${path}`;
};

// Global test setup
beforeAll(async () => {
  try {
    // Start mock server for tests
    global.mockServerPort = await startMockServer();
    
    // Clean up database before all tests
    await cleanupDatabase();
  } catch (error) {
    console.warn('Setup error:', error.message);
  }
});

// Global test teardown
afterAll(async () => {
  const { Queue } = require('bullmq');
  
  try {
    // Clean up scraping queue first to prevent new jobs from starting
    const scrapingQueue = new Queue('web-scraping', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
      }
    });
    
    // Wait a bit for any running jobs to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clean up database after all tests
    await cleanupDatabase();
    
    // Close queue connection
    await scrapingQueue.close();
    
    // Stop mock server
    await stopMockServer();
  } catch (error) {
    console.warn('Error during test teardown cleanup:', error.message);
  } finally {
    await prisma.$disconnect();
  }
});
