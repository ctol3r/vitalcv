# Knowledge Management System (KMS)

## Overview

The Knowledge Management System provides content management capabilities for articles, categories, tags, authors, and version control. It includes workflow management, search functionality, and REST API endpoints.

## Components

### Models

1. **ContentArticle** (`models/ContentArticle.ts`)
   - Fields: id, title, slug, body (HTML/Markdown), summary, status, authorId, categoryIds, tagIds, publishDate, createdAt, updatedAt
   - Supports filtering by status, author, category, and tags
   - Full-text search capabilities

2. **Category** (`models/Category.ts`)
   - Fields: id, name, parentId (nullable), description, sortOrder, createdAt, updatedAt
   - Supports nested categories with parent-child relationships
   - Tree traversal and hierarchy management

3. **Tag** (`models/Tag.ts`)
   - Fields: id, name, description, createdAt, updatedAt
   - Tags can be assigned to multiple articles
   - Search and filtering capabilities

4. **ContentVersion** (`models/ContentVersion.ts`)
   - Fields: id, articleId, versionNumber, content, editorId, createdAt
   - Version control for articles
   - Version comparison and history tracking
   - Restore to previous versions

5. **ContentAuthor** (`models/ContentAuthor.ts`)
   - Fields: id, name, profilePictureUrl, bio, userId (optional), createdAt, updatedAt
   - Used to credit authors of articles
   - Optional link to User model

### Services

1. **ContentWorkflowService** (`services/contentWorkflowService.ts`)
   - Manages article state transitions: draft → review → published → archived
   - Role-based authorization for state changes
   - Logs all state transitions
   - Enforces workflow rules

2. **SearchIndexService** (`services/searchIndexService.ts`)
   - Full-text search across articles
   - Indexes by title, body, tags, categories
   - Supports filtering by status, category, tags, author, publish date
   - Returns relevance scores and matched fields

### API

**ContentAPI** (`api/contentAPI.ts`)
- REST endpoints for articles, categories, tags, authors
- RBAC enforcement
- Endpoints:
  - `GET /api/content/articles` - List articles with filters
  - `GET /api/content/articles/:slug` - Get article by slug
  - `GET /api/content/articles/search` - Search articles
  - `POST /api/content/articles` - Create article (auth required)
  - `PUT /api/content/articles/:id` - Update article (auth required)
  - `DELETE /api/content/articles/:id` - Delete article (editor/admin)
  - `POST /api/content/articles/:id/submit` - Submit for review
  - `POST /api/content/articles/:id/publish` - Approve and publish (admin/publisher)
  - `POST /api/content/articles/:id/reject` - Reject article (editor/admin)
  - `GET /api/content/categories` - List categories
  - `GET /api/content/tags` - List tags
  - `GET /api/content/authors` - List authors
  - `GET /api/content/articles/:id/versions` - Get version history

### Migrations

**Prisma Migration** (`backend/prisma/migrations/20251116141128_add_kms_models/migration.sql`)
- Creates all KMS tables and indexes
- Sets up foreign key relationships
- Creates ContentArticleStatus enum

**Content Seeding** (`migrations/contentMigration.ts`)
- Seeds initial categories (Getting Started, Account Management, Verification, etc.)
- Seeds initial tags (beginner, advanced, api, etc.)
- Seeds sample authors
- Seeds sample articles (idempotent)

### Tests

**ContentCoreTests** (`tests/contentCore.test.ts`)
- Unit tests for all models
- Tests for version control
- Tests for workflow transitions
- Tests for search functionality
- Tests for role-based permissions

## Setup

1. **Run Prisma Migration**:
   ```bash
   cd backend
   npx prisma migrate dev --name add_kms_models
   npx prisma generate
   ```

2. **Seed Initial Data** (optional):
   ```bash
   cd services/kms/migrations
   npx tsx contentMigration.ts
   ```

3. **Register Routes** (in your Express app):
   ```typescript
   import { content } from './routes/content';
   app.use(content);
   ```

## Usage Examples

### Create an Article

```typescript
const article = await articleService.createArticle({
  title: 'My Article',
  slug: 'my-article',
  body: '# Content\n\nArticle body...',
  summary: 'Article summary',
  authorId: authorId,
  categoryIds: [categoryId],
  tagIds: [tagId],
  status: ContentArticleStatus.DRAFT,
});
```

### Workflow Transitions

```typescript
// Submit for review
await workflowService.submitForReview(articleId, userId, ['editor']);

// Approve and publish
await workflowService.approveAndPublish(articleId, userId, ['admin']);

// Archive
await workflowService.archiveArticle(articleId, userId, ['admin']);
```

### Search Articles

```typescript
const results = await searchService.search({
  query: 'verification',
  status: ContentArticleStatus.PUBLISHED,
  categoryIds: [categoryId],
  limit: 20,
});
```

## Status Values

- `DRAFT` - Article is being written
- `REVIEW` - Article submitted for review
- `PUBLISHED` - Article is live
- `ARCHIVED` - Article is archived

## Role-Based Permissions

- **Author/Editor**: Can create, edit, and submit articles for review
- **Editor/Admin**: Can reject articles and send back to draft
- **Admin/Publisher**: Can approve and publish articles
- **Admin**: Can archive articles and restore from archive

## Notes

- All timestamps are in UTC
- Slugs must be unique
- Version history is maintained automatically
- Search index is built in-memory (can be replaced with Elasticsearch for production)
