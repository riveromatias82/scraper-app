const { PrismaClient } = require('@prisma/client');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';

async function initDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Initializing test database...');
    
    // Drop existing tables if they exist (in correct order due to foreign keys)
    await prisma.$executeRaw`DROP TABLE IF EXISTS links`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS pages`;
    await prisma.$executeRaw`DROP TABLE IF EXISTS users`;
    
    // Create the database schema using Prisma
    await prisma.$executeRaw`
      CREATE TABLE users (
        id TEXT NOT NULL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL
      )
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE pages (
        id TEXT NOT NULL PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        linkCount INTEGER NOT NULL DEFAULT 0,
        userId TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL,
        CONSTRAINT pages_userId_fkey FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;
    
    await prisma.$executeRaw`
      CREATE TABLE links (
        id TEXT NOT NULL PRIMARY KEY,
        url TEXT NOT NULL,
        name TEXT NOT NULL,
        isExternal BOOLEAN NOT NULL DEFAULT false,
        pageId TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT links_pageId_fkey FOREIGN KEY (pageId) REFERENCES pages (id) ON DELETE CASCADE ON UPDATE CASCADE
      )
    `;
    
    // Create indexes
    await prisma.$executeRaw`CREATE UNIQUE INDEX users_username_key ON users(username)`;
    await prisma.$executeRaw`CREATE UNIQUE INDEX users_email_key ON users(email)`;
    
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initDatabase();
