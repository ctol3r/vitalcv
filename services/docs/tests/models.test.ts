/**
 * B250A-DOC-010: DocumentModelsTests suite
 *
 * Comprehensive tests validating all document models: relationships, constraints,
 * slug uniqueness, cascade behaviours, and model functionality
 */

import { PrismaClient } from '@prisma/client';
import {
  createDocument,
  getDocumentById,
  getDocumentBySlug,
  updateDocument,
  updateDocumentStatus,
  deleteDocument,
  listDocuments,
  DocumentStatus,
} from '../models/Document';
import {
  createDocumentVersion,
  publishDocumentVersion,
  getDocumentVersionById,
  getDocumentVersions,
  getLatestDocumentVersion,
  getNextVersionNumber,
} from '../models/DocumentVersion';
import {
  createDocumentTag,
  getDocumentTagById,
  getDocumentTagBySlug,
  updateDocumentTag,
  deleteDocumentTag,
  listDocumentTags,
  addTagToDocument,
  removeTagFromDocument,
  getDocumentTags,
} from '../models/DocumentTag';
import {
  createDocumentCategory,
  getDocumentCategoryById,
  getDocumentCategoryBySlug,
  updateDocumentCategory,
  deleteDocumentCategory,
  listDocumentCategories,
  getCategoryHierarchy,
  getChildCategories,
} from '../models/DocumentCategory';
import {
  createDocumentComment,
  getDocumentCommentById,
  getDocumentComments,
  getCommentThread,
  getTopLevelComments,
  updateDocumentComment,
  deleteDocumentComment,
} from '../models/DocumentComment';
import {
  createDocumentHistory,
  getDocumentHistoryById,
  getDocumentHistory,
  getHistoryByEventType,
  getHistoryByUser,
  DocumentEventType,
} from '../models/DocumentHistory';
import {
  createDocumentAccess,
  getDocumentAccessById,
  getDocumentAccesses,
  getUserDocumentAccess,
  getRoleDocumentAccess,
  checkDocumentAccess,
  updateDocumentAccess,
  deleteDocumentAccess,
  removeUserAccess,
  removeRoleAccess,
  AccessLevel,
} from '../models/DocumentAccess';
import {
  createDocumentMedia,
  getDocumentMediaById,
  getDocumentMedia,
  getVersionMedia,
  getMediaByType,
  deleteDocumentMedia,
  deleteVersionMedia,
} from '../models/DocumentMedia';
import {
  upsertDocumentSearchIndex,
  getDocumentSearchIndexById,
  getDocumentSearchIndex,
  getVersionSearchIndex,
  searchDocuments,
  deleteDocumentSearchIndex,
  deleteVersionSearchIndex,
} from '../models/DocumentSearchIndex';

describe('Document Models Tests', () => {
  let prisma: PrismaClient;
  let testUser: any;
  let testCategory: any;
  let testTag: any;

  beforeAll(async () => {
    prisma = new PrismaClient();

    // Create test user
    testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        roles: ['user'],
      },
    });

    // Create test category
    testCategory = await createDocumentCategory(prisma, {
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category description',
    });

    // Create test tag
    testTag = await createDocumentTag(prisma, {
      name: 'Test Tag',
      slug: 'test-tag',
      description: 'Test tag description',
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.documentSearchIndex.deleteMany({});
    await prisma.documentMedia.deleteMany({});
    await prisma.documentComment.deleteMany({});
    await prisma.documentAccess.deleteMany({});
    await prisma.documentHistory.deleteMany({});
    await prisma.documentTagMap.deleteMany({});
    await prisma.documentVersion.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.documentTag.deleteMany({});
    await prisma.documentCategory.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
  });

  describe('Document Model', () => {
    it('should create a document with all required fields', async () => {
      const doc = await createDocument(prisma, {
        title: 'Test Document',
        slug: 'test-document',
        description: 'Test description',
        categoryId: testCategory.id,
        authorId: testUser.id,
        tags: ['tag1', 'tag2'],
        status: DocumentStatus.DRAFT,
      });

      expect(doc).toBeDefined();
      expect(doc.title).toBe('Test Document');
      expect(doc.slug).toBe('test-document');
      expect(doc.description).toBe('Test description');
      expect(doc.categoryId).toBe(testCategory.id);
      expect(doc.authorId).toBe(testUser.id);
      expect(doc.tags).toEqual(['tag1', 'tag2']);
      expect(doc.status).toBe(DocumentStatus.DRAFT);
      expect(doc.publishedAt).toBeNull();
    });

    it('should enforce unique slug constraint', async () => {
      await expect(
        createDocument(prisma, {
          title: 'Another Document',
          slug: 'test-document', // Duplicate slug
          authorId: testUser.id,
        })
      ).rejects.toThrow('already exists');
    });

    it('should get document by ID', async () => {
      const doc = await createDocument(prisma, {
        title: 'Get Test Document',
        slug: 'get-test-document',
        authorId: testUser.id,
      });

      const retrieved = await getDocumentById(prisma, doc.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(doc.id);
      expect(retrieved?.title).toBe('Get Test Document');
    });

    it('should get document by slug', async () => {
      const doc = await createDocument(prisma, {
        title: 'Slug Test Document',
        slug: 'slug-test-document',
        authorId: testUser.id,
      });

      const retrieved = await getDocumentBySlug(prisma, doc.slug);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(doc.id);
    });

    it('should update document', async () => {
      const doc = await createDocument(prisma, {
        title: 'Update Test Document',
        slug: 'update-test-document',
        authorId: testUser.id,
      });

      const updated = await updateDocument(prisma, doc.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated description');
    });

    it('should update document status and set publishedAt', async () => {
      const doc = await createDocument(prisma, {
        title: 'Status Test Document',
        slug: 'status-test-document',
        authorId: testUser.id,
        status: DocumentStatus.DRAFT,
      });

      expect(doc.publishedAt).toBeNull();

      const updated = await updateDocumentStatus(prisma, doc.id, DocumentStatus.PUBLISHED);
      expect(updated.status).toBe(DocumentStatus.PUBLISHED);
      expect(updated.publishedAt).not.toBeNull();
    });

    it('should list documents with filters', async () => {
      const doc1 = await createDocument(prisma, {
        title: 'Filter Test 1',
        slug: 'filter-test-1',
        authorId: testUser.id,
        status: DocumentStatus.PUBLISHED,
      });

      const doc2 = await createDocument(prisma, {
        title: 'Filter Test 2',
        slug: 'filter-test-2',
        authorId: testUser.id,
        status: DocumentStatus.DRAFT,
      });

      const published = await listDocuments(prisma, {
        status: DocumentStatus.PUBLISHED,
      });

      expect(published.length).toBeGreaterThan(0);
      expect(published.some(d => d.id === doc1.id)).toBe(true);
      expect(published.some(d => d.id === doc2.id)).toBe(false);
    });

    it('should delete document', async () => {
      const doc = await createDocument(prisma, {
        title: 'Delete Test Document',
        slug: 'delete-test-document',
        authorId: testUser.id,
      });

      await deleteDocument(prisma, doc.id);

      const retrieved = await getDocumentById(prisma, doc.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('DocumentVersion Model', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await createDocument(prisma, {
        title: 'Version Test Document',
        slug: 'version-test-document',
        authorId: testUser.id,
      });
    });

    it('should create a document version', async () => {
      const version = await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1 content',
        authorId: testUser.id,
        changeSummary: 'Initial version',
      });

      expect(version).toBeDefined();
      expect(version.documentId).toBe(testDocument.id);
      expect(version.versionNumber).toBe(1);
      expect(version.authorId).toBe(testUser.id);
      expect(version.changeSummary).toBe('Initial version');
    });

    it('should enforce unique version number per document', async () => {
      await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1',
        authorId: testUser.id,
      });

      await expect(
        createDocumentVersion(prisma, {
          documentId: testDocument.id,
          versionNumber: 1, // Duplicate version number
          content: 'Version 1 again',
          authorId: testUser.id,
        })
      ).rejects.toThrow('already exists');
    });

    it('should get next version number', async () => {
      await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1',
        authorId: testUser.id,
      });

      const nextVersion = await getNextVersionNumber(prisma, testDocument.id);
      expect(nextVersion).toBe(2);
    });

    it('should publish a version and update document', async () => {
      const version = await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1',
        authorId: testUser.id,
      });

      const result = await publishDocumentVersion(prisma, testDocument.id, version.id);
      expect(result.document.currentVersionId).toBe(version.id);
      expect(result.document.status).toBe('published');
    });

    it('should get all versions for a document', async () => {
      await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1',
        authorId: testUser.id,
      });

      await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 2,
        content: 'Version 2',
        authorId: testUser.id,
      });

      const versions = await getDocumentVersions(prisma, testDocument.id);
      expect(versions.length).toBe(2);
      expect(versions[0].versionNumber).toBe(2); // Should be ordered desc
    });
  });

  describe('DocumentTag Model', () => {
    it('should create a document tag', async () => {
      const tag = await createDocumentTag(prisma, {
        name: 'New Tag',
        slug: 'new-tag',
        description: 'New tag description',
      });

      expect(tag).toBeDefined();
      expect(tag.name).toBe('New Tag');
      expect(tag.slug).toBe('new-tag');
    });

    it('should enforce unique slug constraint', async () => {
      await expect(
        createDocumentTag(prisma, {
          name: 'Another Tag',
          slug: 'test-tag', // Duplicate slug
        })
      ).rejects.toThrow('already exists');
    });

    it('should add tag to document', async () => {
      const doc = await createDocument(prisma, {
        title: 'Tag Test Document',
        slug: 'tag-test-document',
        authorId: testUser.id,
      });

      const mapping = await addTagToDocument(prisma, doc.id, testTag.id);
      expect(mapping.documentId).toBe(doc.id);
      expect(mapping.tagId).toBe(testTag.id);
    });

    it('should get all tags for a document', async () => {
      const doc = await createDocument(prisma, {
        title: 'Get Tags Test',
        slug: 'get-tags-test',
        authorId: testUser.id,
      });

      await addTagToDocument(prisma, doc.id, testTag.id);
      const tags = await getDocumentTags(prisma, doc.id);
      expect(tags.length).toBe(1);
      expect(tags[0].id).toBe(testTag.id);
    });

    it('should remove tag from document', async () => {
      const doc = await createDocument(prisma, {
        title: 'Remove Tag Test',
        slug: 'remove-tag-test',
        authorId: testUser.id,
      });

      await addTagToDocument(prisma, doc.id, testTag.id);
      await removeTagFromDocument(prisma, doc.id, testTag.id);

      const tags = await getDocumentTags(prisma, doc.id);
      expect(tags.length).toBe(0);
    });
  });

  describe('DocumentCategory Model', () => {
    it('should create a document category', async () => {
      const category = await createDocumentCategory(prisma, {
        name: 'New Category',
        slug: 'new-category',
        description: 'New category description',
      });

      expect(category).toBeDefined();
      expect(category.name).toBe('New Category');
      expect(category.slug).toBe('new-category');
    });

    it('should create hierarchical categories', async () => {
      const parent = await createDocumentCategory(prisma, {
        name: 'Parent Category',
        slug: 'parent-category',
      });

      const child = await createDocumentCategory(prisma, {
        name: 'Child Category',
        slug: 'child-category',
        parentCategoryId: parent.id,
      });

      expect(child.parentCategoryId).toBe(parent.id);
    });

    it('should prevent cyclic parent relationships', async () => {
      const parent = await createDocumentCategory(prisma, {
        name: 'Parent',
        slug: 'parent-cyclic',
      });

      const child = await createDocumentCategory(prisma, {
        name: 'Child',
        slug: 'child-cyclic',
        parentCategoryId: parent.id,
      });

      await expect(
        updateDocumentCategory(prisma, parent.id, {
          parentCategoryId: child.id, // Would create cycle
        })
      ).rejects.toThrow('Cyclic parent relationship');
    });

    it('should get category hierarchy', async () => {
      const parent = await createDocumentCategory(prisma, {
        name: 'Hierarchy Parent',
        slug: 'hierarchy-parent',
      });

      const child = await createDocumentCategory(prisma, {
        name: 'Hierarchy Child',
        slug: 'hierarchy-child',
        parentCategoryId: parent.id,
      });

      const hierarchy = await getCategoryHierarchy(prisma, child.id);
      expect(hierarchy.length).toBe(2);
      expect(hierarchy[0].id).toBe(parent.id);
      expect(hierarchy[1].id).toBe(child.id);
    });

    it('should prevent deletion of category with children', async () => {
      const parent = await createDocumentCategory(prisma, {
        name: 'Parent With Children',
        slug: 'parent-with-children',
      });

      await createDocumentCategory(prisma, {
        name: 'Child',
        slug: 'child-of-parent',
        parentCategoryId: parent.id,
      });

      await expect(deleteDocumentCategory(prisma, parent.id)).rejects.toThrow(
        'Cannot delete category with child categories'
      );
    });
  });

  describe('DocumentComment Model', () => {
    let testDocument: any;
    let testVersion: any;

    beforeEach(async () => {
      testDocument = await createDocument(prisma, {
        title: 'Comment Test Document',
        slug: 'comment-test-document',
        authorId: testUser.id,
      });

      testVersion = await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1',
        authorId: testUser.id,
      });
    });

    it('should create a document comment', async () => {
      const comment = await createDocumentComment(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        authorId: testUser.id,
        comment: 'Test comment',
      });

      expect(comment).toBeDefined();
      expect(comment.documentId).toBe(testDocument.id);
      expect(comment.versionId).toBe(testVersion.id);
      expect(comment.comment).toBe('Test comment');
    });

    it('should create threaded comments', async () => {
      const parent = await createDocumentComment(prisma, {
        documentId: testDocument.id,
        authorId: testUser.id,
        comment: 'Parent comment',
      });

      const reply = await createDocumentComment(prisma, {
        documentId: testDocument.id,
        authorId: testUser.id,
        comment: 'Reply comment',
        parentCommentId: parent.id,
      });

      expect(reply.parentCommentId).toBe(parent.id);
    });

    it('should get comment thread', async () => {
      const parent = await createDocumentComment(prisma, {
        documentId: testDocument.id,
        authorId: testUser.id,
        comment: 'Parent',
      });

      const reply1 = await createDocumentComment(prisma, {
        documentId: testDocument.id,
        authorId: testUser.id,
        comment: 'Reply 1',
        parentCommentId: parent.id,
      });

      const thread = await getCommentThread(prisma, parent.id);
      expect(thread.length).toBe(2);
      expect(thread.some(c => c.id === parent.id)).toBe(true);
      expect(thread.some(c => c.id === reply1.id)).toBe(true);
    });

    it('should get top-level comments only', async () => {
      const parent = await createDocumentComment(prisma, {
        documentId: testDocument.id,
        authorId: testUser.id,
        comment: 'Parent',
      });

      await createDocumentComment(prisma, {
        documentId: testDocument.id,
        authorId: testUser.id,
        comment: 'Reply',
        parentCommentId: parent.id,
      });

      const topLevel = await getTopLevelComments(prisma, testDocument.id);
      expect(topLevel.length).toBe(1);
      expect(topLevel[0].id).toBe(parent.id);
    });
  });

  describe('DocumentHistory Model', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await createDocument(prisma, {
        title: 'History Test Document',
        slug: 'history-test-document',
        authorId: testUser.id,
      });
    });

    it('should create a history entry', async () => {
      const history = await createDocumentHistory(prisma, {
        documentId: testDocument.id,
        eventType: DocumentEventType.CREATED,
        userId: testUser.id,
        details: { reason: 'Initial creation' },
      });

      expect(history).toBeDefined();
      expect(history.documentId).toBe(testDocument.id);
      expect(history.eventType).toBe(DocumentEventType.CREATED);
      expect(history.userId).toBe(testUser.id);
    });

    it('should get document history', async () => {
      await createDocumentHistory(prisma, {
        documentId: testDocument.id,
        eventType: DocumentEventType.CREATED,
        userId: testUser.id,
      });

      await createDocumentHistory(prisma, {
        documentId: testDocument.id,
        eventType: DocumentEventType.PUBLISHED,
        userId: testUser.id,
      });

      const history = await getDocumentHistory(prisma, testDocument.id);
      expect(history.length).toBe(2);
    });

    it('should filter history by event type', async () => {
      await createDocumentHistory(prisma, {
        documentId: testDocument.id,
        eventType: DocumentEventType.CREATED,
        userId: testUser.id,
      });

      await createDocumentHistory(prisma, {
        documentId: testDocument.id,
        eventType: DocumentEventType.PUBLISHED,
        userId: testUser.id,
      });

      const published = await getHistoryByEventType(prisma, DocumentEventType.PUBLISHED);
      expect(published.length).toBeGreaterThan(0);
      expect(published.every(h => h.eventType === DocumentEventType.PUBLISHED)).toBe(true);
    });
  });

  describe('DocumentAccess Model', () => {
    let testDocument: any;

    beforeEach(async () => {
      testDocument = await createDocument(prisma, {
        title: 'Access Test Document',
        slug: 'access-test-document',
        authorId: testUser.id,
      });
    });

    it('should create user-based access', async () => {
      const access = await createDocumentAccess(prisma, {
        documentId: testDocument.id,
        userId: testUser.id,
        accessLevel: AccessLevel.READ,
        grantedBy: testUser.id,
      });

      expect(access).toBeDefined();
      expect(access.userId).toBe(testUser.id);
      expect(access.accessLevel).toBe(AccessLevel.READ);
    });

    it('should create role-based access', async () => {
      const access = await createDocumentAccess(prisma, {
        documentId: testDocument.id,
        role: 'admin',
        accessLevel: AccessLevel.ADMIN,
        grantedBy: testUser.id,
      });

      expect(access).toBeDefined();
      expect(access.role).toBe('admin');
      expect(access.userId).toBeNull();
    });

    it('should check document access', async () => {
      await createDocumentAccess(prisma, {
        documentId: testDocument.id,
        userId: testUser.id,
        accessLevel: AccessLevel.WRITE,
        grantedBy: testUser.id,
      });

      const hasRead = await checkDocumentAccess(
        prisma,
        testDocument.id,
        testUser.id,
        [],
        AccessLevel.READ
      );
      expect(hasRead).toBe(true);

      const hasAdmin = await checkDocumentAccess(
        prisma,
        testDocument.id,
        testUser.id,
        [],
        AccessLevel.ADMIN
      );
      expect(hasAdmin).toBe(false);
    });

    it('should enforce unique constraint on documentId, userId, role', async () => {
      await createDocumentAccess(prisma, {
        documentId: testDocument.id,
        userId: testUser.id,
        accessLevel: AccessLevel.READ,
        grantedBy: testUser.id,
      });

      // Should update existing instead of creating duplicate
      const updated = await createDocumentAccess(prisma, {
        documentId: testDocument.id,
        userId: testUser.id,
        accessLevel: AccessLevel.WRITE,
        grantedBy: testUser.id,
      });

      expect(updated.accessLevel).toBe(AccessLevel.WRITE);
    });
  });

  describe('DocumentMedia Model', () => {
    let testDocument: any;
    let testVersion: any;

    beforeEach(async () => {
      testDocument = await createDocument(prisma, {
        title: 'Media Test Document',
        slug: 'media-test-document',
        authorId: testUser.id,
      });

      testVersion = await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1',
        authorId: testUser.id,
      });
    });

    it('should create document media', async () => {
      const media = await createDocumentMedia(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        fileId: 'file-123',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      });

      expect(media).toBeDefined();
      expect(media.documentId).toBe(testDocument.id);
      expect(media.versionId).toBe(testVersion.id);
      expect(media.fileName).toBe('test.pdf');
      expect(media.fileSize).toBe(1024);
    });

    it('should get media for a version', async () => {
      await createDocumentMedia(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        fileId: 'file-1',
        fileName: 'file1.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
      });

      const media = await getVersionMedia(prisma, testDocument.id, testVersion.id);
      expect(media.length).toBe(1);
      expect(media[0].fileName).toBe('file1.pdf');
    });
  });

  describe('DocumentSearchIndex Model', () => {
    let testDocument: any;
    let testVersion: any;

    beforeEach(async () => {
      testDocument = await createDocument(prisma, {
        title: 'Search Test Document',
        slug: 'search-test-document',
        authorId: testUser.id,
      });

      testVersion = await createDocumentVersion(prisma, {
        documentId: testDocument.id,
        versionNumber: 1,
        content: 'Version 1 content',
        authorId: testUser.id,
      });
    });

    it('should create search index', async () => {
      const index = await upsertDocumentSearchIndex(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        content: 'Searchable content',
        tags: 'tag1, tag2',
        category: 'Test Category',
      });

      expect(index).toBeDefined();
      expect(index.content).toBe('Searchable content');
      expect(index.tags).toBe('tag1, tag2');
    });

    it('should update existing search index', async () => {
      await upsertDocumentSearchIndex(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        content: 'Original content',
      });

      const updated = await upsertDocumentSearchIndex(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should search documents', async () => {
      await upsertDocumentSearchIndex(prisma, {
        documentId: testDocument.id,
        versionId: testVersion.id,
        content: 'This is searchable content',
        tags: 'test, document',
      });

      const results = await searchDocuments(prisma, 'searchable');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.documentId === testDocument.id)).toBe(true);
    });
  });

  describe('Cascade Behaviours', () => {
    it('should cascade delete document versions when document is deleted', async () => {
      const doc = await createDocument(prisma, {
        title: 'Cascade Test',
        slug: 'cascade-test',
        authorId: testUser.id,
      });

      const version = await createDocumentVersion(prisma, {
        documentId: doc.id,
        versionNumber: 1,
        content: 'Content',
        authorId: testUser.id,
      });

      await deleteDocument(prisma, doc.id);

      const retrievedVersion = await getDocumentVersionById(prisma, version.id);
      expect(retrievedVersion).toBeNull();
    });

    it('should cascade delete comments when document is deleted', async () => {
      const doc = await createDocument(prisma, {
        title: 'Cascade Comment Test',
        slug: 'cascade-comment-test',
        authorId: testUser.id,
      });

      const comment = await createDocumentComment(prisma, {
        documentId: doc.id,
        authorId: testUser.id,
        comment: 'Test comment',
      });

      await deleteDocument(prisma, doc.id);

      const retrievedComment = await getDocumentCommentById(prisma, comment.id);
      expect(retrievedComment).toBeNull();
    });

    it('should cascade delete tag mappings when document is deleted', async () => {
      const doc = await createDocument(prisma, {
        title: 'Cascade Tag Test',
        slug: 'cascade-tag-test',
        authorId: testUser.id,
      });

      await addTagToDocument(prisma, doc.id, testTag.id);
      await deleteDocument(prisma, doc.id);

      const tags = await getDocumentTags(prisma, doc.id);
      expect(tags.length).toBe(0);
    });
  });
});

