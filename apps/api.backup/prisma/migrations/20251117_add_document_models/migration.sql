-- B250A-DOC-001 to B250A-DOC-009: Document Management Models Migration
-- This migration adds all document-related models with proper relationships and constraints

-- Create DocumentEventType enum
CREATE TYPE "DocumentEventType" AS ENUM ('CREATED', 'PUBLISHED', 'ARCHIVED', 'VERSION_ADDED', 'UPDATED', 'DELETED');

-- Update Document model: add slug (unique), description, categoryId (FK)
ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "slug" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- Create unique constraint on slug
CREATE UNIQUE INDEX IF NOT EXISTS "Document_slug_key" ON "Document"("slug");

-- Remove old category column if it exists (string field)
ALTER TABLE "Document" DROP COLUMN IF EXISTS "category";

-- Update DocumentVersion model: change createdById to authorId, content to JSON
ALTER TABLE "DocumentVersion"
  RENAME COLUMN "createdById" TO "authorId";

-- Change content column type to JSONB
ALTER TABLE "DocumentVersion"
  ALTER COLUMN "content" TYPE JSONB USING content::jsonb;

-- Remove versionToken if it exists (not in requirements)
ALTER TABLE "DocumentVersion" DROP COLUMN IF EXISTS "versionToken";

-- Update DocumentHistory model: change action to eventType, performedById to userId, changes to details
ALTER TABLE "DocumentHistory"
  RENAME COLUMN "action" TO "eventType",
  RENAME COLUMN "performedById" TO "userId",
  RENAME COLUMN "changes" TO "details";

-- Change eventType to use enum
ALTER TABLE "DocumentHistory"
  ALTER COLUMN "eventType" TYPE "DocumentEventType" USING eventType::"DocumentEventType";

-- Rename timestamp column if needed
ALTER TABLE "DocumentHistory" RENAME COLUMN IF EXISTS "createdAt" TO "timestamp";

-- Update DocumentComment model: add versionId, change parentId to parentCommentId, content to comment
ALTER TABLE "DocumentComment"
  ADD COLUMN IF NOT EXISTS "versionId" TEXT,
  RENAME COLUMN "parentId" TO "parentCommentId",
  RENAME COLUMN "content" TO "comment";

-- Remove updatedAt and deletedAt if they exist (not in requirements)
ALTER TABLE "DocumentComment" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "DocumentComment" DROP COLUMN IF EXISTS "deletedAt";

-- Update DocumentAccess model: change grantedById to grantedBy, add updatedAt, remove grantedAt/revokedAt
ALTER TABLE "DocumentAccess"
  RENAME COLUMN "grantedById" TO "grantedBy";

-- Add updatedAt if it doesn't exist
ALTER TABLE "DocumentAccess"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Remove grantedAt and revokedAt if they exist
ALTER TABLE "DocumentAccess" DROP COLUMN IF EXISTS "grantedAt";
ALTER TABLE "DocumentAccess" DROP COLUMN IF EXISTS "revokedAt";

-- Create DocumentTag model
CREATE TABLE IF NOT EXISTS "DocumentTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTag_pkey" PRIMARY KEY ("id")
);

-- Create DocumentTagMap join table
CREATE TABLE IF NOT EXISTS "DocumentTagMap" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTagMap_pkey" PRIMARY KEY ("documentId", "tagId")
);

-- Create DocumentCategory model
CREATE TABLE IF NOT EXISTS "DocumentCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parentCategoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

-- Create DocumentMedia model
CREATE TABLE IF NOT EXISTS "DocumentMedia" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentMedia_pkey" PRIMARY KEY ("id")
);

-- Create DocumentSearchIndex model
CREATE TABLE IF NOT EXISTS "DocumentSearchIndex" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSearchIndex_pkey" PRIMARY KEY ("id")
);

-- Create indexes for DocumentTag
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTag_slug_key" ON "DocumentTag"("slug");
CREATE INDEX IF NOT EXISTS "DocumentTag_slug_idx" ON "DocumentTag"("slug");
CREATE INDEX IF NOT EXISTS "DocumentTag_name_idx" ON "DocumentTag"("name");

-- Create indexes for DocumentTagMap
CREATE INDEX IF NOT EXISTS "DocumentTagMap_documentId_idx" ON "DocumentTagMap"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentTagMap_tagId_idx" ON "DocumentTagMap"("tagId");

-- Create indexes for DocumentCategory
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentCategory_slug_key" ON "DocumentCategory"("slug");
CREATE INDEX IF NOT EXISTS "DocumentCategory_slug_idx" ON "DocumentCategory"("slug");
CREATE INDEX IF NOT EXISTS "DocumentCategory_name_idx" ON "DocumentCategory"("name");
CREATE INDEX IF NOT EXISTS "DocumentCategory_parentCategoryId_idx" ON "DocumentCategory"("parentCategoryId");

-- Create indexes for DocumentMedia
CREATE INDEX IF NOT EXISTS "DocumentMedia_documentId_idx" ON "DocumentMedia"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentMedia_versionId_idx" ON "DocumentMedia"("versionId");
CREATE INDEX IF NOT EXISTS "DocumentMedia_fileId_idx" ON "DocumentMedia"("fileId");
CREATE INDEX IF NOT EXISTS "DocumentMedia_fileType_idx" ON "DocumentMedia"("fileType");

-- Create indexes for DocumentSearchIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSearchIndex_documentId_versionId_key" ON "DocumentSearchIndex"("documentId", "versionId");
CREATE INDEX IF NOT EXISTS "DocumentSearchIndex_documentId_idx" ON "DocumentSearchIndex"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentSearchIndex_versionId_idx" ON "DocumentSearchIndex"("versionId");
CREATE INDEX IF NOT EXISTS "DocumentSearchIndex_createdAt_idx" ON "DocumentSearchIndex"("createdAt");

-- Add foreign key constraints
ALTER TABLE "Document" ADD CONSTRAINT "Document_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "DocumentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentHistory" ADD CONSTRAINT "DocumentHistory_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentComment" ADD CONSTRAINT "DocumentComment_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentAccess" ADD CONSTRAINT "DocumentAccess_grantedBy_fkey"
    FOREIGN KEY ("grantedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DocumentTagMap" ADD CONSTRAINT "DocumentTagMap_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentTagMap" ADD CONSTRAINT "DocumentTagMap_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "DocumentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentCategory" ADD CONSTRAINT "DocumentCategory_parentCategoryId_fkey"
    FOREIGN KEY ("parentCategoryId") REFERENCES "DocumentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DocumentMedia" ADD CONSTRAINT "DocumentMedia_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentMedia" ADD CONSTRAINT "DocumentMedia_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentSearchIndex" ADD CONSTRAINT "DocumentSearchIndex_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentSearchIndex" ADD CONSTRAINT "DocumentSearchIndex_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update indexes for DocumentVersion
CREATE INDEX IF NOT EXISTS "DocumentVersion_authorId_idx" ON "DocumentVersion"("authorId");

-- Update indexes for DocumentHistory
CREATE INDEX IF NOT EXISTS "DocumentHistory_eventType_idx" ON "DocumentHistory"("eventType");
CREATE INDEX IF NOT EXISTS "DocumentHistory_userId_idx" ON "DocumentHistory"("userId");
CREATE INDEX IF NOT EXISTS "DocumentHistory_timestamp_idx" ON "DocumentHistory"("timestamp");

-- Update indexes for DocumentComment
CREATE INDEX IF NOT EXISTS "DocumentComment_versionId_idx" ON "DocumentComment"("versionId");
CREATE INDEX IF NOT EXISTS "DocumentComment_parentCommentId_idx" ON "DocumentComment"("parentCommentId");

-- Update indexes for DocumentAccess
CREATE INDEX IF NOT EXISTS "DocumentAccess_accessLevel_idx" ON "DocumentAccess"("accessLevel");

