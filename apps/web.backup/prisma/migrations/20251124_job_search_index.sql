-- CreateTable
CREATE TABLE "JobSearchIndex" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "keywords" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobSearchIndex_jobId_idx" ON "JobSearchIndex"("jobId");

-- CreateIndex
CREATE INDEX "JobSearchIndex_createdAt_idx" ON "JobSearchIndex"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobSearchIndex_jobId_key" ON "JobSearchIndex"("jobId");


