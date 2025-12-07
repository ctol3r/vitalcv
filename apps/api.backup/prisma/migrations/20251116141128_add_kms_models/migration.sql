-- B243A-KMS: Knowledge Management System Models Migration
-- Create enum for ContentArticleStatus
CREATE TYPE "ContentArticleStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- Create ContentAuthor table
CREATE TABLE IF NOT EXISTS "ContentAuthor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "bio" TEXT,
    "userId" TEXT UNIQUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAuthor_pkey" PRIMARY KEY ("id")
);

-- Create Category table
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Create Tag table
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL UNIQUE,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- Create ContentArticle table
CREATE TABLE IF NOT EXISTS "ContentArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL UNIQUE,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ContentArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentArticle_pkey" PRIMARY KEY ("id")
);

-- Create ContentVersion table
CREATE TABLE IF NOT EXISTS "ContentVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- Create ContentArticleCategory junction table
CREATE TABLE IF NOT EXISTS "ContentArticleCategory" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentArticleCategory_pkey" PRIMARY KEY ("id")
);

-- Create ContentArticleTag junction table
CREATE TABLE IF NOT EXISTS "ContentArticleTag" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentArticleTag_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ContentAuthor
CREATE INDEX IF NOT EXISTS "ContentAuthor_userId_idx" ON "ContentAuthor"("userId");
CREATE INDEX IF NOT EXISTS "ContentAuthor_name_idx" ON "ContentAuthor"("name");

-- Create indexes for Category
CREATE INDEX IF NOT EXISTS "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX IF NOT EXISTS "Category_sortOrder_idx" ON "Category"("sortOrder");

-- Create indexes for Tag
CREATE INDEX IF NOT EXISTS "Tag_name_idx" ON "Tag"("name");

-- Create indexes for ContentArticle
CREATE INDEX IF NOT EXISTS "ContentArticle_slug_idx" ON "ContentArticle"("slug");
CREATE INDEX IF NOT EXISTS "ContentArticle_status_idx" ON "ContentArticle"("status");
CREATE INDEX IF NOT EXISTS "ContentArticle_authorId_idx" ON "ContentArticle"("authorId");
CREATE INDEX IF NOT EXISTS "ContentArticle_publishDate_idx" ON "ContentArticle"("publishDate");
CREATE INDEX IF NOT EXISTS "ContentArticle_createdAt_idx" ON "ContentArticle"("createdAt");

-- Create indexes for ContentVersion
CREATE UNIQUE INDEX IF NOT EXISTS "ContentVersion_articleId_versionNumber_key" ON "ContentVersion"("articleId", "versionNumber");
CREATE INDEX IF NOT EXISTS "ContentVersion_articleId_idx" ON "ContentVersion"("articleId");
CREATE INDEX IF NOT EXISTS "ContentVersion_editorId_idx" ON "ContentVersion"("editorId");
CREATE INDEX IF NOT EXISTS "ContentVersion_createdAt_idx" ON "ContentVersion"("createdAt");

-- Create indexes for ContentArticleCategory
CREATE UNIQUE INDEX IF NOT EXISTS "ContentArticleCategory_articleId_categoryId_key" ON "ContentArticleCategory"("articleId", "categoryId");
CREATE INDEX IF NOT EXISTS "ContentArticleCategory_articleId_idx" ON "ContentArticleCategory"("articleId");
CREATE INDEX IF NOT EXISTS "ContentArticleCategory_categoryId_idx" ON "ContentArticleCategory"("categoryId");

-- Create indexes for ContentArticleTag
CREATE UNIQUE INDEX IF NOT EXISTS "ContentArticleTag_articleId_tagId_key" ON "ContentArticleTag"("articleId", "tagId");
CREATE INDEX IF NOT EXISTS "ContentArticleTag_articleId_idx" ON "ContentArticleTag"("articleId");
CREATE INDEX IF NOT EXISTS "ContentArticleTag_tagId_idx" ON "ContentArticleTag"("tagId");

-- Add foreign key constraints
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ContentArticle" ADD CONSTRAINT "ContentArticle_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "ContentAuthor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "ContentArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentArticleCategory" ADD CONSTRAINT "ContentArticleCategory_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "ContentArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentArticleCategory" ADD CONSTRAINT "ContentArticleCategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentArticleTag" ADD CONSTRAINT "ContentArticleTag_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "ContentArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentArticleTag" ADD CONSTRAINT "ContentArticleTag_tagId_fkey"
    FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

