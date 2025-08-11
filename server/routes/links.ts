import express, { Response } from 'express';
import { query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Validation middleware
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

// Get all links for a specific page with pagination
router.get('/page/:pageId', validatePagination, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pageId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Verify page belongs to user
    const pageExists = await prisma.page.findFirst({
      where: {
        id: pageId,
        userId: req.user!.userId
      }
    });

    if (!pageExists) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Get links with pagination
    const links = await prisma.link.findMany({
      where: {
        pageId
      },
      select: {
        id: true,
        url: true,
        name: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalLinks = await prisma.link.count({
      where: {
        pageId
      }
    });

    const totalPages = Math.ceil(Number(totalLinks) / limit);

    res.json({
      links,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: Number(totalLinks),
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Get all links for the authenticated user with pagination
router.get('/', validatePagination, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    // Get links with page information
    const links = await prisma.link.findMany({
      where: {
        page: {
          userId: req.user!.userId
        }
      },
      select: {
        id: true,
        url: true,
        name: true,
        createdAt: true,
        page: {
          select: {
            id: true,
            url: true,
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalLinks = await prisma.link.count({
      where: {
        page: {
          userId: req.user!.userId
        }
      }
    });

    const totalPages = Math.ceil(Number(totalLinks) / limit);

    res.json({
      links,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: Number(totalLinks),
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

// Search links
router.get('/search', validatePagination, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { q } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Search links by text or href
    const links = await prisma.link.findMany({
      where: {
        AND: [
          {
            page: {
              userId: req.user!.userId
            }
          },
          {
            OR: [
              {
                name: {
                  contains: q
                }
              },
              {
                url: {
                  contains: q
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        url: true,
        name: true,
        createdAt: true,
        page: {
          select: {
            id: true,
            url: true,
            title: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: offset,
      take: limit
    });

    // Get total count for pagination
    const totalLinks = await prisma.link.count({
      where: {
        AND: [
          {
            page: {
            userId: req.user!.userId
            }
          },
          {
            OR: [
              {
                name: {
                  contains: q
                }
              },
              {
                url: {
                  contains: q
                }
              }
            ]
          }
        ]
      }
    });

    const totalPages = Math.ceil(Number(totalLinks) / limit);

    res.json({
      links,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: Number(totalLinks),
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      searchQuery: q
    });
  } catch (error) {
    console.error('Error searching links:', error);
    res.status(500).json({ error: 'Failed to search links' });
  }
});

export default router;
