# Document Management Services

This directory contains the complete document management system implementation for B250B-DOC tasks.

## Services

### Core Services

1. **DocumentService** (`services/documentService.ts`)
   - `createDocument()` - Create new documents with validation
   - `updateMetadata()` - Update document metadata with permission checks
   - `publishDocument()` - Publish documents
   - `archiveDocument()` - Archive documents
   - All operations update DocumentHistory

2. **DocumentVersioningService** (`services/documentVersioningService.ts`)
   - `createVersion()` - Create new document versions with optimistic locking
   - `getVersion()` - Get specific version
   - `listVersions()` - List all versions for a document
   - Handles version token management for optimistic locking

3. **DocumentCommentService** (`services/documentCommentService.ts`)
   - `createComment()` - Create comments with threaded replies
   - `updateComment()` - Update comments (author only)
   - `deleteComment()` - Soft delete comments
   - `getComments()` - Get all comments with threading
   - Triggers notifications to document authors

4. **DocumentAccessService** (`services/documentAccessService.ts`)
   - `grantAccess()` - Grant user/role-based access
   - `revokeAccess()` - Revoke access
   - `getAccessList()` - List all access grants
   - `checkAccess()` - Check user permissions
   - Integrates with RBAC system

5. **FullTextSearchService** (`services/fullTextSearchService.ts`)
   - `search()` - Search documents with filters
   - Supports category and tag filtering
   - Returns relevance scores and highlights
   - Uses PostgreSQL text search

6. **DocumentLockService** (`services/documentLockService.ts`)
   - `acquireLock()` - Acquire optimistic lock with version token
   - `verifyLock()` - Verify token before save
   - `releaseLock()` - Release lock
   - `extendLock()` - Extend lock expiry
   - `cleanupExpiredLocks()` - Cleanup expired locks

7. **CollaborativeEditingService** (`services/collaborativeEditingService.ts`)
   - `joinRoom()` - Join collaborative editing room
   - `leaveRoom()` - Leave room
   - `saveCollaborativeContent()` - Save merged content to DocumentVersion
   - `resolveConflicts()` - Resolve edit conflicts
   - Placeholder for Yjs integration

8. **DocumentNotificationService** (`services/documentNotificationService.ts`)
   - `notifyPublished()` - Notify on publish events
   - `notifyUpdated()` - Notify on update events
   - `notifyArchived()` - Notify on archive events
   - Uses existing Notification system
   - Template-based messages

### Analytics

9. **DocumentAnalyticsService** (`analytics/documentAnalyticsService.ts`)
   - `trackEvent()` - Track VIEW, DOWNLOAD, EDIT, TIME_SPENT events
   - `getReport()` - Get analytics report for a document
   - `getAggregatedMetrics()` - Get aggregated metrics
   - Stores anonymized data

## API Routes

All routes are in `routes/documentAPI.ts`:

- `POST /api/documents` - Create document
- `GET /api/documents/:id` - Get document
- `PUT /api/documents/:id` - Update document
- `POST /api/documents/:id/publish` - Publish document
- `POST /api/documents/:id/archive` - Archive document
- `GET /api/documents` - List documents (paginated)
- `POST /api/documents/:id/versions` - Create version
- `GET /api/documents/:id/versions` - List versions
- `POST /api/documents/:id/comments` - Create comment
- `GET /api/documents/:id/comments` - Get comments
- `PUT /api/documents/:id/comments/:commentId` - Update comment
- `DELETE /api/documents/:id/comments/:commentId` - Delete comment
- `POST /api/documents/:id/access` - Grant access
- `GET /api/documents/:id/access` - Get access list
- `DELETE /api/documents/:id/access` - Revoke access
- `GET /api/documents/search` - Search documents
- `POST /api/documents/:id/lock` - Acquire lock
- `POST /api/documents/:id/lock/verify` - Verify lock
- `DELETE /api/documents/:id/lock` - Release lock
- `POST /api/documents/:id/analytics` - Track event
- `GET /api/documents/:id/analytics` - Get analytics report

## Database Models

All models are in `prisma/schema.prisma`:

- `Document` - Main document model
- `DocumentVersion` - Version history
- `DocumentHistory` - Action history
- `DocumentComment` - Comments with threading
- `DocumentAccess` - Access control
- `DocumentAnalytics` - Analytics events
- `DocumentLock` - Optimistic locking

## Testing

Unit tests are in `__tests__/docs/`:

- `documentService.test.ts` - Tests for DocumentService
- `documentVersioningService.test.ts` - Tests for DocumentVersioningService

## Usage

```typescript
import { documentService } from './services/docs/services/documentService.js';

// Create a document
const doc = await documentService.createDocument({
  title: 'My Document',
  content: 'Content here',
  authorId: userId,
});

// Publish it
await documentService.publishDocument({
  documentId: doc.id,
  userId: userId,
});
```

## Next Steps

1. Run Prisma migration to create database tables
2. Register document routes in main Express app
3. Add integration tests
4. Integrate Yjs for real-time collaborative editing
5. Add Elasticsearch for advanced search (optional)

