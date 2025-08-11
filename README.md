# Web Scraper Application

A full-stack web application for scraping web pages and extracting all links. Built with React, Node.js, Express, TypeScript, Prisma, SQLite, BullMQ, and Redis.

## Features

- **User Authentication**: Register and login with username/email and password
- **Web Scraping**: Add URLs to scrape and extract all links from web pages
- **Background Processing**: Asynchronous scraping using BullMQ and Redis
- **Real-time Status**: Track scraping progress (Pending, Processing, Completed, Failed)
- **Link Management**: View and search through extracted links
- **Pagination**: Efficient pagination for both pages and links
- **Responsive Design**: Modern, mobile-friendly UI built with Tailwind CSS
- **Search Functionality**: Search links by name or URL
- **Retry Mechanism**: Retry failed scraping jobs
- **JWT Authentication**: Secure token-based authentication
- **Type Safety**: Full TypeScript support for better development experience

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **TypeScript** - Type-safe JavaScript development
- **Express** - Web framework
- **Prisma** - Database ORM
- **SQLite** - Database
- **BullMQ** - Job queue for background processing
- **Redis** - Message broker and caching
- **Cheerio** - HTML parsing and scraping
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Jest & Supertest** - Testing
- **ESLint** - Code linting and style enforcement

### Frontend
- **React** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Hot Toast** - Notifications
- **clsx** - Conditional className utility
- **tailwind-merge** - Tailwind CSS class merging utility

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Redis** server

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd scraper-app
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   npm install

   # Install frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp env.example .env

   # Edit .env with your configuration
   # Make sure to set a strong JWT_SECRET
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Run database migrations
   npm run db:migrate

   # Set up test database (one-time setup for running tests)
   # On Windows:
   set DATABASE_URL=file:./test.db && npx prisma migrate deploy --schema=./prisma/schema.prisma
   
   # On macOS/Linux:
   DATABASE_URL=file:./test.db npx prisma migrate deploy --schema=./prisma/schema.prisma
   ```

5. **Start Redis server**

   **Option A: Using Docker Compose (Recommended)**
   ```bash
   docker-compose up -d
   ```

   **Option B: Using Docker command**
   ```bash
   # Create volume (if it doesn't exist)
   docker volume create redis_data
   
   # Run Redis container
   docker run -d --name scraper-app-redis -p 6379:6379 -v redis_data:/data --restart unless-stopped redis:7-alpine redis-server --appendonly yes
   ```

   **Option C: Using system services**
   ```bash
   # On macOS with Homebrew
   brew services start redis

   # On Ubuntu/Debian
   sudo systemctl start redis

   # On Windows
   # Start Redis server manually or use WSL
   ```

## Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   npm run server:dev
   ```

2. **Start the frontend development server**
   ```bash
   npm run client:dev
   ```

3. **Or run both simultaneously**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Production Mode

1. **Build the frontend and backend**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm run server:start
   ```

## TypeScript Development

The backend is fully written in TypeScript, providing:

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Enhanced autocomplete and IntelliSense
- **Self-Documenting Code**: Types serve as documentation
- **Safer Refactoring**: Type checking prevents breaking changes

### TypeScript Scripts

```bash
# Type checking without emission
npm run type-check

# Build TypeScript to JavaScript
npm run server:build

# Development server with hot reload
npm run server:dev

# Production server
npm run server:start

# Linting TypeScript files
npm run lint
npm run lint:fix
```

### ESLint Configuration

The project uses ESLint with TypeScript support for code quality and consistency:

- **Configuration**: `.eslintrc.js` - ESLint rules and TypeScript integration
- **Rules**: Enforces TypeScript best practices, code quality, and consistent formatting
- **Integration**: Works with TypeScript compiler and development tools
- **Scripts**: Use `npm run lint` to check for issues and `npm run lint:fix` to automatically fix them

### Type Definitions

Comprehensive type definitions are available in `server/types/index.ts`:

- **User Authentication**: Registration, login, JWT payload types
- **Scraping Operations**: Page metadata, link extraction, job processing
- **API Responses**: Standardized response formats and pagination
- **Database Models**: Prisma-generated types with custom extensions
- **Environment Variables**: Type-safe configuration
- **Error Handling**: Custom error types and validation

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Pages
- `GET /api/pages` - Get user's pages (with pagination)
- `POST /api/pages` - Add a new page for scraping
- `GET /api/pages/:id` - Get specific page details
- `DELETE /api/pages/:id` - Delete a page
- `POST /api/pages/:id/retry` - Retry failed scraping

### Links
- `GET /api/links` - Get all user's links (with pagination)
- `GET /api/links/page/:pageId` - Get links for a specific page
- `GET /api/links/search` - Search links by name or URL

## Database Schema

### Users
- `id` - Unique identifier
- `username` - Username (unique)
- `email` - Email address (unique)
- `password` - Hashed password
- `createdAt` - Account creation timestamp
- `updatedAt` - Last update timestamp

### Pages
- `id` - Unique identifier
- `url` - Page URL
- `title` - Page title
- `status` - Scraping status (PENDING, PROCESSING, COMPLETED, FAILED)
- `linkCount` - Number of links found
- `userId` - Foreign key to user
- `createdAt` - Creation timestamp
- `updatedAt` - Last update timestamp

### Links
- `id` - Unique identifier
- `url` - Link URL
- `name` - Link text/name
- `isExternal` - Whether the link is external
- `pageId` - Foreign key to page
- `createdAt` - Creation timestamp

## Testing

The application includes a comprehensive test suite covering all major components. The tests are configured to run with a separate test database and proper cleanup.

### Test Setup

- **Test Database**: Uses a separate SQLite database (`prisma/test.db`) for testing
- **Environment**: Test-specific environment variables are set in `server/__tests__/setup.js`
- **Cleanup**: Tests automatically clean up data and close connections after completion
- **Coverage**: Jest coverage reporting is configured for the server code

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (requires git repository)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Initialize test database
npm run test:init-db

# Setup and run tests
npm run test:setup
```

### Test Coverage

The test suite currently covers:
- ✅ **Authentication** - User registration and login (successful and error cases)
- ✅ **Input Validation** - Email format, password length, and duplicate email handling
- ✅ **Middleware** - Authentication middleware, rate limiting, and error handling
- ✅ **Database Operations** - Database connections, migrations, and cleanup
- ✅ **Pages API** - CRUD operations for pages, status updates, and error handling
- ✅ **Links API** - Link retrieval, pagination, search, and filtering
- ✅ **Error Responses** - Proper HTTP status codes and error messages

### Test Files Structure

- `auth.test.js` - Authentication endpoint tests
- `middleware.test.js` - Middleware functionality tests
- `db.test.js` - Database connection and operation tests
- `pages.test.js` - Pages API endpoint tests
- `links.test.js` - Links API endpoint tests
- `setup.js` - Test environment configuration
- `testConfig.js` - Test configuration utilities
- `testHelpers.js` - Common test helper functions
- `mockServer.js` - Mock server for testing
- `utils/` - Test utility functions
- `services/` - Service layer tests

### Test Configuration

- **Jest Configuration**: `jest.config.js` - Configured for Node.js environment
- **Test Files**: Located in `server/__tests__/` directory
- **Setup File**: `server/__tests__/setup.js` - Test environment configuration
- **Database**: Separate test database with migrations applied
- **Cleanup**: Proper cleanup of Prisma, Redis, and BullMQ connections

### Recent Test Improvements

The test suite has been recently improved to resolve several issues:

- **Database Setup**: Fixed test database configuration and migration setup
- **Jest Configuration**: Updated to properly exclude setup files from test execution
- **Server Management**: Modified server to only start when running as main module
- **Connection Cleanup**: Added proper cleanup for all database and queue connections
- **Open Handles**: Resolved Jest exit issues by properly closing BullMQ workers and queues
- **Comprehensive Coverage**: Added tests for all API endpoints, middleware, and database operations
- **Test Utilities**: Created helper functions and mock servers for better test organization

## Project Structure

```
scraper-app/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts
│   │   └── ...
│   ├── package.json
│   └── tailwind.config.js
├── server/                 # Node.js backend (TypeScript)
│   ├── __tests__/         # Test files
│   │   ├── auth.test.js   # Authentication tests
│   │   ├── middleware.test.js # Middleware tests
│   │   ├── db.test.js     # Database tests
│   │   ├── pages.test.js  # Pages API tests
│   │   ├── links.test.js  # Links API tests
│   │   ├── setup.js       # Test environment setup
│   │   ├── testConfig.js  # Test configuration
│   │   ├── testHelpers.js # Test helper functions
│   │   ├── mockServer.js  # Mock server for testing
│   │   ├── utils/         # Test utilities
│   │   └── services/      # Service layer tests
│   ├── middleware/        # Express middleware
│   │   └── auth.ts        # Authentication middleware
│   ├── routes/            # API routes
│   │   ├── auth.ts        # Authentication routes
│   │   ├── pages.ts       # Page management routes
│   │   └── links.ts       # Link management routes
│   ├── services/          # Business logic
│   │   └── scraperService.ts # Web scraping service
│   ├── types/             # TypeScript type definitions
│   │   ├── index.ts       # Main type definitions
│   │   └── bcryptjs.d.ts  # Custom type declarations
│   └── index.ts           # Server entry point
├── prisma/                # Database schema and migrations
├── dist/                  # Compiled JavaScript (production)
├── package.json
├── tsconfig.json          # TypeScript configuration
├── nodemon.json           # Development server configuration
├── jest.config.js         # Jest test configuration
├── .eslintrc.js          # ESLint configuration
├── docker-compose.yml     # Redis container configuration
├── env.example           # Environment variables template
└── README.md
```

## Usage

1. **Register/Login**: Create an account or sign in with existing credentials
2. **Add URLs**: Enter a URL in the dashboard and click "Scrape"
3. **Monitor Progress**: Watch the scraping status in real-time
4. **View Results**: Click "View Links" to see all extracted links
5. **Search Links**: Use the search functionality to find specific links
6. **Manage Pages**: Delete pages or retry failed scraping jobs

## Scraping Process

1. User submits a URL for scraping
2. Page is created with PENDING status
3. Scraping job is added to BullMQ queue
4. Worker processes the job:
   - Updates status to PROCESSING
   - Fetches the webpage using Cheerio
   - Extracts all `<a>` tags and their attributes
   - Saves links to database
   - Updates page status to COMPLETED
5. User can view results in real-time

## Error Handling

- **Network Errors**: Automatic retry with exponential backoff
- **Invalid URLs**: Validation before processing
- **Authentication**: JWT token validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **Graceful Shutdown**: Proper cleanup of connections
- **Type Safety**: TypeScript prevents many runtime errors

## Security Features

- **Password Hashing**: bcryptjs for secure password storage
- **JWT Tokens**: Secure authentication
- **Input Validation**: Server-side validation for all inputs
- **CORS**: Configured for security
- **Helmet**: Security headers
- **Rate Limiting**: Protection against abuse

## Performance Features

- **Background Processing**: Non-blocking scraping operations
- **Pagination**: Efficient data loading
- **Database Indexing**: Optimized queries
- **Caching**: Redis for job queue and caching
- **Connection Pooling**: Efficient database connections
- **Type Safety**: TypeScript optimizations and better code quality

## Troubleshooting

### TypeScript Issues

**Compilation errors:**
- Run `npm run type-check` to identify type issues
- Ensure all dependencies have proper type definitions
- Check `tsconfig.json` configuration

**Development server not starting:**
- Verify TypeScript is properly installed: `npm install typescript`
- Check that `ts-node` and `tsconfig-paths` are installed
- Ensure `nodemon.json` is properly configured

**ESLint issues:**
- Ensure ESLint and TypeScript ESLint packages are installed: `npm install`
- Check that `.eslintrc.js` configuration is valid
- Run `npm run lint` to identify specific linting issues
- Use `npm run lint:fix` to automatically fix formatting issues

### Test Issues

**Jest not exiting properly:**
- Ensure Redis server is running
- Check that all database connections are properly closed
- Verify BullMQ workers and queues are being cleaned up
- Check that all test files are properly closing connections in teardown

**Database connection errors:**
- Make sure the test database is set up: `npm run db:migrate`
- Verify the `DATABASE_URL` in test setup points to the correct test database
- Check that Prisma client is generated: `npm run db:generate`
- Ensure test database migrations are applied: `npm run test:init-db`

**Watch mode not working:**
- Jest watch mode requires a git repository
- Use `npm run test:watch` only in a git repository
- For non-git environments, use `npm test` to run tests once

**Test coverage issues:**
- Run `npm run test:coverage` to generate coverage reports
- Check that all test files are being included in the test suite
- Verify that mock servers and test utilities are properly configured

### Common Issues

**Redis connection errors:**
- Ensure Redis server is running on the configured port (default: 6379)
- Check Redis connection settings in environment variables

**Port conflicts:**
- The application uses ports 3000 (frontend) and 5000 (backend)
- Ensure these ports are available or configure different ports in environment variables

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass and TypeScript compiles without errors
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository.
