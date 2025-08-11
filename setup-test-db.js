const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';

async function setupTestDatabase() {
  try {
    console.log('Setting up test database...');
    
    // Use Prisma db push to sync the database with the schema
    execSync('npx prisma db push --schema=./prisma/schema.prisma --force-reset', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db'
      }
    });
    
    console.log('Test database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  }
}

setupTestDatabase();
