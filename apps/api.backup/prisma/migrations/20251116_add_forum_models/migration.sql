-- B234A-COMM-001: Add ForumCategory table
-- B234A-COMM-002: Add ForumPost table
-- B234A-COMM-003: Add ForumComment table

-- Create CategoryVisibility enum
CREATE TYPE "CategoryVisibility" AS ENUM ('public', 'private');

-- Create PostStatus enum
CREATE TYPE "PostStatus" AS ENUM ('active', 'locked', 'pinned');

-- Create ForumCategory table
CREATE TABLE IF NOT EXISTS "ForumCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "visibility" "CategoryVisibility" NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumCategory_pkey" PRIMARY KEY ("id")
);

-- Create ForumPost table
CREATE TABLE IF NOT EXISTS "ForumPost" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PostStatus" NOT NULL DEFAULT 'active',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumPost_pkey" PRIMARY KEY ("id")
);

-- Create ForumComment table
CREATE TABLE IF NOT EXISTS "ForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForumComment_pkey" PRIMARY KEY ("id")
);

-- Create indexes for ForumCategory
CREATE INDEX IF NOT EXISTS "ForumCategory_parentId_idx" ON "ForumCategory"("parentId");
CREATE INDEX IF NOT EXISTS "ForumCategory_visibility_idx" ON "ForumCategory"("visibility");
CREATE INDEX IF NOT EXISTS "ForumCategory_createdAt_idx" ON "ForumCategory"("createdAt");

-- Create indexes for ForumPost
CREATE INDEX IF NOT EXISTS "ForumPost_categoryId_idx" ON "ForumPost"("categoryId");
CREATE INDEX IF NOT EXISTS "ForumPost_authorId_idx" ON "ForumPost"("authorId");
CREATE INDEX IF NOT EXISTS "ForumPost_status_idx" ON "ForumPost"("status");
CREATE INDEX IF NOT EXISTS "ForumPost_tags_idx" ON "ForumPost" USING GIN("tags");
CREATE INDEX IF NOT EXISTS "ForumPost_createdAt_idx" ON "ForumPost"("createdAt");
CREATE INDEX IF NOT EXISTS "ForumPost_deletedAt_idx" ON "ForumPost"("deletedAt");

-- Create indexes for ForumComment
CREATE INDEX IF NOT EXISTS "ForumComment_postId_idx" ON "ForumComment"("postId");
CREATE INDEX IF NOT EXISTS "ForumComment_parentCommentId_idx" ON "ForumComment"("parentCommentId");
CREATE INDEX IF NOT EXISTS "ForumComment_authorId_idx" ON "ForumComment"("authorId");
CREATE INDEX IF NOT EXISTS "ForumComment_createdAt_idx" ON "ForumComment"("createdAt");
CREATE INDEX IF NOT EXISTS "ForumComment_deletedAt_idx" ON "ForumComment"("deletedAt");

-- Add foreign key constraints
ALTER TABLE "ForumCategory" ADD CONSTRAINT "ForumCategory_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "ForumCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ForumCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumPost" ADD CONSTRAINT "ForumPost_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_parentCommentId_fkey"
    FOREIGN KEY ("parentCommentId") REFERENCES "ForumComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ForumComment" ADD CONSTRAINT "ForumComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

