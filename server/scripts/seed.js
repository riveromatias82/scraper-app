const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create a test user
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      username: 'testuser',
      email: 'test@example.com',
      password: hashedPassword,
    },
  });

  console.log('Created test user:', user.username);

  // Create some sample pages
  const samplePages = [
    {
      url: 'https://example.com',
      title: 'Example Domain',
      status: 'COMPLETED',
      linkCount: 5,
      userId: user.id,
    },
    {
      url: 'https://httpbin.org',
      title: 'HTTPBin',
      status: 'COMPLETED',
      linkCount: 3,
      userId: user.id,
    },
  ];

  for (const pageData of samplePages) {
    const page = await prisma.page.upsert({
      where: { 
        url_userId: {
          url: pageData.url,
          userId: user.id
        }
      },
      update: {},
      create: pageData,
    });

    console.log('Created page:', page.title);

    // Create sample links for each page
    const sampleLinks = [
      {
        url: 'https://example.com/page1',
        name: 'Sample Link 1',
        pageId: page.id,
      },
      {
        url: 'https://example.com/page2',
        name: 'Sample Link 2',
        pageId: page.id,
      },
      {
        url: 'https://example.com/page3',
        name: 'Sample Link 3',
        pageId: page.id,
      },
    ];

    for (const linkData of sampleLinks) {
      await prisma.link.upsert({
        where: {
          url_pageId: {
            url: linkData.url,
            pageId: page.id
          }
        },
        update: {},
        create: linkData,
      });
    }

    console.log(`Created ${sampleLinks.length} links for ${page.title}`);
  }

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
