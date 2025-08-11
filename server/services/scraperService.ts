import axios from 'axios';
import * as cheerio from 'cheerio';
import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { ScrapingResult, ScrapedPage, ScrapedLink, ScrapingOptions } from '../types';

const prisma = new PrismaClient();

// Create Redis connection
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};

// Create scraping queue
const scrapingQueue = new Queue('web-scraping', {
  connection: redisConfig
});

// Scraping function
const scrapePage = async (url: string, options?: ScrapingOptions): Promise<ScrapedPage> => {
  try {
    console.log(`Starting to scrape: ${url}`);
    
    const response = await axios.get(url, {
      timeout: options?.timeout || 30000,
      headers: {
        'User-Agent': options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Extract page title
    const title = $('title').text() || $('h1').first().text() || 'Untitled';
    
    // Extract page description
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || '';
    
    // Extract all links
    const links: ScrapedLink[] = [];
    $('a[href]').each((index, element) => {
      const $element = $(element);
      const href = $element.attr('href');
      const linkText = $element.text().trim();
      
      // Skip empty links or javascript links
      if (!href || href.startsWith('javascript:') || href === '#') {
        return;
      }
      
      // Convert relative URLs to absolute URLs
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, url).href;
      } catch (error) {
        console.warn(`Invalid URL: ${href}`);
        return;
      }
      
      // Extract link name (text content or alt text)
      let linkName = linkText;
      if (!linkName) {
        // Try to get alt text from images inside the link
        const img = $element.find('img');
        if (img.length > 0) {
          linkName = img.attr('alt') || img.attr('title') || 'Image Link';
        } else {
          // Try to get title attribute
          linkName = $element.attr('title') || 'Link';
        }
      }
      
      // Truncate very long link names
      if (linkName.length > 200) {
        linkName = linkName.substring(0, 197) + '...';
      }
      
      // Determine if link is external
      const isExternal = !absoluteUrl.startsWith(new URL(url).origin);
      
      links.push({
        href: absoluteUrl,
        text: linkName || 'Link',
        isExternal,
        title: $element.attr('title') || undefined
      });
    });

    // Limit number of links if specified
    const limitedLinks = options?.maxLinks ? links.slice(0, options.maxLinks) : links;

    return {
      url,
      title: title.trim(),
      description: description.trim(),
      links: limitedLinks,
      metadata: {
        contentType: response.headers['content-type'],
        statusCode: response.status,
        responseTime: Date.now(),
        size: response.data.length,
        lastModified: response.headers['last-modified']
      },
      scrapedAt: new Date()
    };
  } catch (error: any) {
    console.error(`Error scraping ${url}:`, error.message);
    throw new Error(`Failed to scrape page: ${error.message}`);
  }
};

// Create scraping worker (only if not in test environment)
const scraperWorker = process.env.NODE_ENV === 'test' ? null : new Worker('web-scraping', async (job) => {
  const { pageId, url } = job.data;
  
  try {
    // Use a transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check if page exists and update status atomically
      const existingPage = await tx.page.findUnique({
        where: { id: pageId }
      });

      if (!existingPage) {
        throw new Error('Page not found');
      }

      // Update page status to processing
      await tx.page.update({
        where: { id: pageId },
        data: { status: 'PROCESSING' }
      });

      // Scrape the page
      const scrapedData = await scrapePage(url);

      // Update page with scraped data
      const updatedPage = await tx.page.update({
        where: { id: pageId },
        data: {
          title: scrapedData.title,
          status: 'COMPLETED',
          linkCount: scrapedData.links.length
        }
      });

      // Create link records
      const linkData = scrapedData.links.map(link => ({
        url: link.href,
        name: link.text,
        isExternal: link.isExternal,
        pageId: pageId
      }));

      if (linkData.length > 0) {
        await tx.link.createMany({
          data: linkData
        });
      }

      return updatedPage;
    });

    console.log(`Successfully scraped page ${pageId}: ${result.title}`);
    return result;
  } catch (error: any) {
    console.error(`Error processing scraping job for page ${pageId}:`, error);
    
    // Update page status to failed only if page exists
    try {
      const existingPage = await prisma.page.findUnique({
        where: { id: pageId }
      });
      
      if (existingPage) {
        await prisma.page.update({
          where: { id: pageId },
          data: { 
            status: 'FAILED',
            title: 'Scraping Failed'
          }
        });
      } else {
        console.warn(`Page ${pageId} not found, skipping status update`);
      }
    } catch (updateError) {
      console.error(`Failed to update page status to failed for page ${pageId}:`, updateError);
    }

    throw error;
  }
}, {
  connection: redisConfig,
  concurrency: 1, // Process one job at a time
  removeOnComplete: { count: 10 }, // Keep last 10 completed jobs
  removeOnFail: { count: 5 } // Keep last 5 failed jobs
});

// Handle worker events
if (scraperWorker) {
  scraperWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  scraperWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  scraperWorker.on('error', (err) => {
    console.error('Worker error:', err);
  });
}



// Add scraping job to queue
const addScrapingJob = async (pageId: string, url: string, userId: string, options?: ScrapingOptions) => {
  const job = await scrapingQueue.add('scrape-page', {
    pageId,
    url,
    userId,
    options
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });

  return job;
};

// Get job status
const getJobStatus = async (jobId: string) => {
  const job = await scrapingQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    status: await job.getState(),
    progress: job.progress,
    data: job.data,
    failedReason: job.failedReason
  };
};

// Validate URL
const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

// Extract links from HTML
const extractLinks = (html: string, baseUrl: string): ScrapedLink[] => {
  const $ = cheerio.load(html);
  const links: ScrapedLink[] = [];

  $('a[href]').each((index, element) => {
    const $element = $(element);
    const href = $element.attr('href');
    const linkText = $element.text().trim();
    
    if (!href || href.startsWith('javascript:') || href === '#') {
      return;
    }
    
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, baseUrl).href;
    } catch {
      return;
    }
    
    const isExternal = !absoluteUrl.startsWith(new URL(baseUrl).origin);
    
    links.push({
      href: absoluteUrl,
      text: linkText || 'Link',
      isExternal,
      title: $element.attr('title') || undefined
    });
  });

  return links;
};

// Main scraping function with result type
const scrapeUrl = async (url: string, options?: ScrapingOptions): Promise<ScrapingResult> => {
  const startTime = Date.now();
  
  try {
    const scrapedData = await scrapePage(url, options);
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      data: scrapedData,
      duration
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: error.message,
      duration
    };
  }
};

// Cleanup function for graceful shutdown
const cleanup = async () => {
  try {
    console.log('Cleaning up scraper service...');
    if (scraperWorker) {
      await scraperWorker.close();
    }
    await scrapingQueue.close();
    await prisma.$disconnect();
    console.log('Scraper service cleanup completed');
  } catch (error) {
    console.error('Error during scraper service cleanup:', error);
  }
};

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

const scraperService = {
  scrapeUrl,
  validateUrl,
  extractLinks,
  addScrapingJob,
  getJobStatus,
  scrapePage,
  cleanup
};

export default scraperService;
