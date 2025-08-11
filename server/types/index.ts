import { Request } from 'express';

// User-related types
export interface UserRegistrationData {
  username: string;
  email: string;
  password: string;
}

export interface UserLoginData {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface AuthResponse {
  message: string;
  user: UserResponse;
  token: string;
}

// JWT payload type
export interface JWTPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

// Extended Request type with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username?: string;
  };
}

// Scraping-related types
export interface ScrapedLink {
  href: string;
  text: string;
  isExternal: boolean;
  title?: string | undefined;
}

export interface ScrapedPage {
  url: string;
  title: string;
  description?: string;
  links: ScrapedLink[];
  metadata: PageMetadata;
  scrapedAt: Date;
}

export interface PageMetadata {
  contentType?: string;
  statusCode?: number;
  responseTime?: number;
  size?: number;
  lastModified?: string;
}

export interface ScrapingJob {
  url: string;
  userId: string;
  priority: 'high' | 'medium' | 'low';
  options?: ScrapingOptions;
}

export interface ScrapingOptions {
  followRedirects?: boolean;
  timeout?: number;
  userAgent?: string;
  maxLinks?: number;
  includeImages?: boolean;
}

export interface ScrapingResult {
  success: boolean;
  data?: ScrapedPage;
  error?: string;
  duration: number;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Validation error types
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationErrorResponse {
  errors: ValidationError[];
}

// Database types (extending Prisma types)
export interface PageWithLinks {
  id: string;
  url: string;
  title: string;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  links: Link[];
}

export interface Link {
  id: string;
  href: string;
  text: string;
  isExternal: boolean;
  pageId: string;
  createdAt: Date;
}

// Environment variables type
export interface EnvironmentVariables {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REDIS_URL: string;
  DATABASE_URL: string;
  RATE_LIMIT_WINDOW_MS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
}

// Queue types
export interface QueueJobData {
  type: 'scrape' | 'process' | 'cleanup';
  payload: any;
  priority?: number;
  delay?: number;
}

// Error types
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// Middleware types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

// Service types
export interface ScraperService {
  scrapeUrl(url: string, options?: ScrapingOptions): Promise<ScrapingResult>;
  validateUrl(url: string): boolean;
  extractLinks(html: string, baseUrl: string): ScrapedLink[];
}
