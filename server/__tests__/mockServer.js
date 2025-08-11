const http = require('http');
const url = require('url');

// Mock HTML content for different test scenarios
const mockResponses = {
  '/example': {
    status: 200,
    content: `
      <html>
        <head><title>Example Page</title></head>
        <body>
          <h1>Welcome to Example</h1>
          <a href="https://example.com/page1">Page 1</a>
          <a href="https://example.com/page2">Page 2</a>
          <a href="https://external.com">External Link</a>
          <a href="javascript:void(0)">JavaScript Link</a>
          <a href="#">Empty Link</a>
        </body>
      </html>
    `
  },
  '/user1': {
    status: 200,
    content: `
      <html>
        <head><title>User 1 Page</title></head>
        <body>
          <h1>User 1 Content</h1>
          <a href="https://user1.com/profile">Profile</a>
          <a href="https://user1.com/settings">Settings</a>
        </body>
      </html>
    `
  },
  '/user2': {
    status: 200,
    content: `
      <html>
        <head><title>User 2 Page</title></head>
        <body>
          <h1>User 2 Content</h1>
          <a href="https://user2.com/dashboard">Dashboard</a>
          <a href="https://user2.com/reports">Reports</a>
        </body>
      </html>
    `
  },
  '/blocked': {
    status: 403,
    content: 'Access Forbidden'
  },
  '/timeout': {
    status: 500,
    content: 'Server Error'
  }
};

// Create mock server
const mockServer = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  const path = parsedUrl.pathname;
  
  // Find matching mock response
  const mockResponse = mockResponses[path] || mockResponses['/example'];
  
  // Set headers
  res.writeHead(mockResponse.status, {
    'Content-Type': 'text/html',
    'Content-Length': Buffer.byteLength(mockResponse.content)
  });
  
  // Send response
  res.end(mockResponse.content);
});



// Start server on a random port
let mockServerPort = null;

const startMockServer = () => {
  return new Promise((resolve) => {
    mockServer.listen(0, () => {
      mockServerPort = mockServer.address().port;
      console.log(`Mock server started on port ${mockServerPort}`);
      resolve(mockServerPort);
    });
  });
};

const stopMockServer = () => {
  return new Promise((resolve) => {
    mockServer.close(() => {
      console.log('Mock server stopped');
      resolve();
    });
  });
};

// Helper function to get mock URL
const getMockUrl = (path = '') => {
  if (!mockServerPort) {
    throw new Error('Mock server not started');
  }
  return `http://localhost:${mockServerPort}${path}`;
};

module.exports = {
  startMockServer,
  stopMockServer,
  getMockUrl,
  mockServer
};
