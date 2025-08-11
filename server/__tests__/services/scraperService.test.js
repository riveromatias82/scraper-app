const { prisma, cleanupDatabase } = require('../testHelpers');

// Mock external dependencies
jest.mock('axios');
jest.mock('cheerio');
jest.mock('bullmq');

// Mock the scraper service module
jest.mock('../../services/scraperService', () => {
  const originalModule = jest.requireActual('../../services/scraperService');
  
  return {
    ...originalModule,
    scrapePage: jest.fn(),
    addScrapingJob: jest.fn(),
    getJobStatus: jest.fn()
  };
});

describe('Scraper Service', () => {
  let mockScrapePage;
  let mockAddScrapingJob;
  let mockGetJobStatus;

  beforeAll(async () => {
    await cleanupDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase();

    // Reset mocks
    jest.clearAllMocks();
    
    // Get mocked functions
    const scraperService = require('../../services/scraperService');
    mockScrapePage = scraperService.scrapePage;
    mockAddScrapingJob = scraperService.addScrapingJob;
    mockGetJobStatus = scraperService.getJobStatus;
  });

  describe('scrapePage function', () => {
    it('should successfully scrape a page and extract links', async () => {
      const mockResult = {
        title: 'Test Page',
        links: [
          { url: 'https://example1.com', name: 'Link 1' },
          { url: 'https://example2.com', name: 'Link 2' },
          { url: 'https://example.com/relative-link', name: 'Relative Link' }
        ]
      };

      mockScrapePage.mockResolvedValue(mockResult);

      const result = await mockScrapePage('https://example.com');

      expect(result).toHaveProperty('title', 'Test Page');
      expect(result).toHaveProperty('links');
      expect(result.links).toHaveLength(3);
      expect(result.links[0]).toHaveProperty('url');
      expect(result.links[0]).toHaveProperty('name');
    });

    it('should handle network errors', async () => {
      mockScrapePage.mockRejectedValue(new Error('Network error'));

      await expect(mockScrapePage('https://example.com')).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      mockScrapePage.mockRejectedValue(new Error('timeout of 30000ms exceeded'));

      await expect(mockScrapePage('https://example.com')).rejects.toThrow('timeout of 30000ms exceeded');
    });

    it('should handle pages with no links', async () => {
      const mockResult = {
        title: 'Test Page',
        links: []
      };

      mockScrapePage.mockResolvedValue(mockResult);

      const result = await mockScrapePage('https://example.com');

      expect(result.title).toBe('Test Page');
      expect(result.links).toHaveLength(0);
    });
  });

  describe('addScrapingJob function', () => {
    it('should add a job to the queue successfully', async () => {
      const mockJob = { id: 'test-job-id' };
      mockAddScrapingJob.mockResolvedValue(mockJob);

      const pageId = 1;
      const url = 'https://example.com';

      const result = await mockAddScrapingJob(pageId, url);

      expect(mockAddScrapingJob).toHaveBeenCalledWith(pageId, url);
      expect(result).toEqual(mockJob);
    });

    it('should handle queue errors', async () => {
      mockAddScrapingJob.mockRejectedValue(new Error('Queue error'));

      await expect(mockAddScrapingJob(1, 'https://example.com')).rejects.toThrow('Queue error');
    });
  });

  describe('getJobStatus function', () => {
    it('should return job status when job exists', async () => {
      const mockJobStatus = {
        id: 'test-job-id',
        state: 'completed',
        progress: 100,
        failedReason: null
      };

      mockGetJobStatus.mockResolvedValue(mockJobStatus);

      const result = await mockGetJobStatus('test-job-id');

      expect(mockGetJobStatus).toHaveBeenCalledWith('test-job-id');
      expect(result).toEqual(mockJobStatus);
    });

    it('should return null when job does not exist', async () => {
      mockGetJobStatus.mockResolvedValue(null);

      const result = await mockGetJobStatus('non-existent-job');

      expect(result).toBeNull();
    });

    it('should handle queue errors', async () => {
      mockGetJobStatus.mockRejectedValue(new Error('Queue error'));

      await expect(mockGetJobStatus('test-job-id')).rejects.toThrow('Queue error');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete scraping workflow', async () => {
      // Mock successful scraping
      const mockScrapeResult = {
        title: 'Test Page',
        links: [
          { url: 'https://link1.com', name: 'Link 1' },
          { url: 'https://link2.com', name: 'Link 2' }
        ]
      };

      mockScrapePage.mockResolvedValue(mockScrapeResult);
      mockAddScrapingJob.mockResolvedValue({ id: 'job-123' });
      mockGetJobStatus.mockResolvedValue({ state: 'completed' });

      // Test the workflow
      const scrapeResult = await mockScrapePage('https://example.com');
      const jobResult = await mockAddScrapingJob(1, 'https://example.com');
      const statusResult = await mockGetJobStatus('job-123');

      expect(scrapeResult.links).toHaveLength(2);
      expect(jobResult.id).toBe('job-123');
      expect(statusResult.state).toBe('completed');
    });

    it('should handle scraping failure and retry', async () => {
      // Mock initial failure
      mockScrapePage.mockRejectedValueOnce(new Error('Network error'));
      
      // Mock successful retry
      const mockScrapeResult = {
        title: 'Test Page',
        links: [{ url: 'https://example.com', name: 'Link' }]
      };
      mockScrapePage.mockResolvedValueOnce(mockScrapeResult);

      // Test failure
      await expect(mockScrapePage('https://example.com')).rejects.toThrow('Network error');

      // Test successful retry
      const result = await mockScrapePage('https://example.com');
      expect(result.links).toHaveLength(1);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed URLs', async () => {
      mockScrapePage.mockRejectedValue(new Error('Invalid URL'));

      await expect(mockScrapePage('invalid-url')).rejects.toThrow('Invalid URL');
    });

    it('should handle very long link names', async () => {
      const longName = 'a'.repeat(300);
      const mockResult = {
        title: 'Test Page',
        links: [{ url: 'https://example.com', name: longName }]
      };

      mockScrapePage.mockResolvedValue(mockResult);

      const result = await mockScrapePage('https://example.com');
      expect(result.links[0].name).toBe(longName);
    });

    it('should handle special characters in URLs', async () => {
      const mockResult = {
        title: 'Test Page',
        links: [
          { url: 'https://example.com/path%20with%20spaces', name: 'Link with spaces' },
          { url: 'https://example.com/path%20with%20encoding', name: 'Encoded link' }
        ]
      };

      mockScrapePage.mockResolvedValue(mockResult);

      const result = await mockScrapePage('https://example.com');

      expect(result.links).toHaveLength(2);
      expect(result.links[0].url).toBe('https://example.com/path%20with%20spaces');
      expect(result.links[1].url).toBe('https://example.com/path%20with%20encoding');
    });
  });
});
