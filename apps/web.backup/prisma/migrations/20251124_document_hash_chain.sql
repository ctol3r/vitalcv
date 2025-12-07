-- Task 103.1: Document hash chain persistence
-- Adds DocumentHashChain table to maintain sequential hash history per doc.

CREATE TABLE IF NOT EXISTS "DocumentHashChain" (
  "id" TEXT PRIMARY KEY,
  "docId" TEXT NOT NULL UNIQUE,
  "hashSeq" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

