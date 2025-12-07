/**
 * B243A-KMS-009: ContentMigration seeds
 *
 * Initial migration to seed categories and sample articles (e.g. help topics)
 * Includes helper script
 * Tested to ensure idempotent
 */

import { PrismaClient, ContentArticleStatus } from '@prisma/client';
import { CategoryService } from '../models/Category';
import { TagService } from '../models/Tag';
import { ContentAuthorService } from '../models/ContentAuthor';
import { ContentArticleService } from '../models/ContentArticle';

/**
 * Seed initial categories
 */
async function seedCategories(prisma: PrismaClient) {
  const categoryService = new CategoryService(prisma);

  const categories = [
    {
      name: 'Getting Started',
      description: 'Help articles for new users',
      sortOrder: 1,
    },
    {
      name: 'Account Management',
      description: 'Managing your account and settings',
      sortOrder: 2,
    },
    {
      name: 'Verification',
      description: 'Identity verification and credential management',
      sortOrder: 3,
    },
    {
      name: 'API Documentation',
      description: 'Developer API documentation',
      sortOrder: 4,
    },
    {
      name: 'Troubleshooting',
      description: 'Common issues and solutions',
      sortOrder: 5,
    },
  ];

  const createdCategories: { [key: string]: string } = {};

  for (const cat of categories) {
    const existing = await categoryService.getCategoryByName(cat.name);
    if (existing) {
      createdCategories[cat.name] = existing.id;
    } else {
      const created = await categoryService.createCategory(cat);
      createdCategories[cat.name] = created.id;
    }
  }

  return createdCategories;
}

/**
 * Seed initial tags
 */
async function seedTags(prisma: PrismaClient) {
  const tagService = new TagService(prisma);

  const tags = [
    { name: 'beginner', description: 'For beginners' },
    { name: 'advanced', description: 'Advanced topics' },
    { name: 'api', description: 'API-related content' },
    { name: 'verification', description: 'Verification process' },
    { name: 'credentials', description: 'Credential management' },
    { name: 'faq', description: 'Frequently asked questions' },
  ];

  const createdTags: { [key: string]: string } = {};

  for (const tag of tags) {
    const existing = await tagService.getTagByName(tag.name);
    if (existing) {
      createdTags[tag.name] = existing.id;
    } else {
      const created = await tagService.createTag(tag);
      createdTags[tag.name] = created.id;
    }
  }

  return createdTags;
}

/**
 * Seed initial authors
 */
async function seedAuthors(prisma: PrismaClient) {
  const authorService = new ContentAuthorService(prisma);

  const authors = [
    {
      name: 'System Administrator',
      bio: 'System-generated content author',
    },
    {
      name: 'Help Desk',
      bio: 'Customer support team',
    },
    {
      name: 'Documentation Team',
      bio: 'Technical documentation writers',
    },
  ];

  const createdAuthors: { [key: string]: string } = {};

  for (const author of authors) {
    const existing = await authorService.searchAuthors(author.name, 1);
    if (existing.length > 0) {
      createdAuthors[author.name] = existing[0].id;
    } else {
      const created = await authorService.createAuthor(author);
      createdAuthors[author.name] = created.id;
    }
  }

  return createdAuthors;
}

/**
 * Seed sample articles
 */
async function seedArticles(
  prisma: PrismaClient,
  categories: { [key: string]: string },
  tags: { [key: string]: string },
  authors: { [key: string]: string }
) {
  const articleService = new ContentArticleService(prisma);

  const articles = [
    {
      title: 'Welcome to the Platform',
      slug: 'welcome-to-the-platform',
      body: `
# Welcome to the Platform

This is your guide to getting started with our platform.

## What is this platform?

Our platform provides secure identity verification and credential management.

## Getting Started

1. Create an account
2. Complete verification
3. Start using the platform

For more information, see our [documentation](/api/content/articles/api-documentation).
      `,
      summary: 'Introduction to the platform and getting started guide',
      authorId: authors['System Administrator'],
      categoryIds: [categories['Getting Started']],
      tagIds: [tags['beginner'], tags['faq']],
      status: ContentArticleStatus.PUBLISHED,
      publishDate: new Date(),
    },
    {
      title: 'How to Verify Your Identity',
      slug: 'how-to-verify-your-identity',
      body: `
# How to Verify Your Identity

Identity verification is a crucial step in using our platform.

## Steps

1. Submit your NPI number
2. Complete email verification
3. Upload required documents
4. Wait for approval

## Requirements

- Valid NPI number
- Government-issued ID
- Recent photo

For detailed instructions, contact support.
      `,
      summary: 'Step-by-step guide to identity verification',
      authorId: authors['Help Desk'],
      categoryIds: [categories['Verification']],
      tagIds: [tags['verification'], tags['beginner']],
      status: ContentArticleStatus.PUBLISHED,
      publishDate: new Date(),
    },
    {
      title: 'API Authentication Guide',
      slug: 'api-authentication-guide',
      body: `
# API Authentication Guide

Learn how to authenticate with our API.

## Getting API Keys

1. Log into your account
2. Navigate to API settings
3. Generate a new API key

## Using API Keys

Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Rate Limits

- 100 requests per minute
- 1000 requests per hour

See our [API documentation](/api/content/articles/api-documentation) for more details.
      `,
      summary: 'Guide to API authentication and usage',
      authorId: authors['Documentation Team'],
      categoryIds: [categories['API Documentation']],
      tagIds: [tags['api'], tags['advanced']],
      status: ContentArticleStatus.PUBLISHED,
      publishDate: new Date(),
    },
  ];

  const createdArticles: string[] = [];

  for (const article of articles) {
    const existing = await articleService.getArticleBySlug(article.slug);
    if (!existing) {
      const created = await articleService.createArticle(article);
      createdArticles.push(created.id);
    } else {
      createdArticles.push(existing.id);
    }
  }

  return createdArticles;
}

/**
 * Main seed function - idempotent
 */
export async function seedContent(prisma: PrismaClient): Promise<void> {
  console.log('Seeding KMS content...');

  try {
    // Seed categories
    console.log('Seeding categories...');
    const categories = await seedCategories(prisma);
    console.log(`Created/found ${Object.keys(categories).length} categories`);

    // Seed tags
    console.log('Seeding tags...');
    const tags = await seedTags(prisma);
    console.log(`Created/found ${Object.keys(tags).length} tags`);

    // Seed authors
    console.log('Seeding authors...');
    const authors = await seedAuthors(prisma);
    console.log(`Created/found ${Object.keys(authors).length} authors`);

    // Seed articles
    console.log('Seeding articles...');
    const articles = await seedArticles(prisma, categories, tags, authors);
    console.log(`Created/found ${articles.length} articles`);

    console.log('Content seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding content:', error);
    throw error;
  }
}

/**
 * Run seed if called directly
 */
if (require.main === module) {
  const prisma = new PrismaClient();

  seedContent(prisma)
    .then(() => {
      console.log('Seed completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

