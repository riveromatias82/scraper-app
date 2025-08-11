import express, { Response } from 'express';
import { body, validationResult, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import scraperService from '../services/scraperService';

const router = express.Router();
const prisma = new PrismaClient();

// Validation middleware
const validateUrl = [
  body('url')
    .isURL()
    .withMessage('Please provide a valid URL')
    .matches(/^https?:\/\//)
    .withMessage('URL must start with http:// or https://')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Get all pages for the authenticated user with pagination
router.get('/', validatePagination, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    // Get pages with link count
    const pages = await prisma.page.findMany({
      where: {
        userId: req.user!.userId
      },
      select: {
        id: true,
        url: true,
        title: true,
        status: true,
        linkCount: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalPages = await prisma.page.count({
      where: {
        userId: req.user!.userId
      }
    });

    const totalPagesCount = Math.ceil(Number(totalPages) / limit);

    res.json({
      pages,
      pagination: {
        currentPage: page,
        totalPages: totalPagesCount,
        totalItems: Number(totalPages),
        itemsPerPage: limit,
        hasNextPage: page < totalPagesCount,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// Get a specific page by ID
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const page = await prisma.page.findFirst({
      where: {
        id,
        userId: req.user!.userId
      },
      select: {
        id: true,
        url: true,
        title: true,

        status: true,
        linkCount: true,
        createdAt: true,
        updatedAt: true,
        links: {
          select: {
            id: true,
            url: true,
            name: true,

            createdAt: true
          }
        }
      }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ page });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// Create a new page (start scraping)
router.post('/', validateUrl, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { url } = req.body;

    // Check if page already exists for this user
    const existingPage = await prisma.page.findFirst({
      where: {
        url,
        userId: req.user!.userId
      }
    });

    if (existingPage) {
      return res.status(400).json({ 
        error: 'This URL has already been added for scraping' 
      });
    }

    // Create page record
    const page = await prisma.page.create({
      data: {
        url,
        userId: req.user!.userId,
        status: 'PENDING'
      },
      select: {
        id: true,
        url: true,
        status: true,
        createdAt: true
      }
    });

    // Add scraping job to queue
    await scraperService.addScrapingJob(page.id, url, req.user!.userId);

    res.status(201).json({
      message: 'Page scraping started',
      page
    });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({ error: 'Failed to create page' });
  }
});

// Delete a page
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if page exists and belongs to user
    const page = await prisma.page.findFirst({
      where: {
        id,
        userId: req.user!.userId
      }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Delete page and all associated links (cascade)
    await prisma.page.delete({
      where: { id }
    });

    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Retry scraping for a page
router.post('/:id/retry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if page exists and belongs to user
    const page = await prisma.page.findFirst({
      where: {
        id,
        userId: req.user!.userId
      }
    });

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Only allow retry for failed pages
    if (page.status !== 'FAILED') {
      return res.status(400).json({ error: 'Only failed pages can be retried' });
    }

    // Update page status to pending
    await prisma.page.update({
      where: { id },
      data: { status: 'PENDING' }
    });

    // Add scraping job to queue
    await scraperService.addScrapingJob(page.id, page.url, req.user!.userId);

    res.json({ message: 'Page scraping restarted' });
  } catch (error) {
    console.error('Error retrying page:', error);
    res.status(500).json({ error: 'Failed to retry page scraping' });
  }
});

export default router;
