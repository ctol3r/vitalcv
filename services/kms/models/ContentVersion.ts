/**
 * B243A-KMS-004: ContentVersion model & service
 *
 * Implements version control for content articles.
 * Fields: id, articleId, versionNumber, content, editorId, createdAt
 * Service manages creating new versions, retrieving history, comparing versions
 */

import { PrismaClient, ContentVersion as PrismaContentVersion } from '@prisma/client';

export interface ContentVersionInput {
  articleId: string;
  content: string; // Snapshot of article content
  editorId: string;
}

export interface ContentVersionOutput {
  id: string;
  articleId: string;
  versionNumber: number;
  content: string;
  editorId: string;
  createdAt: Date;
}

export interface VersionComparison {
  version1: ContentVersionOutput;
  version2: ContentVersionOutput;
  differences: string[];
}

/**
 * ContentVersionService
 *
 * Manages version control for content articles
 */
export class ContentVersionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new version for an article
   */
  async createVersion(input: ContentVersionInput): Promise<ContentVersionOutput> {
    // Get the latest version number
    const latest = await this.prisma.contentVersion.findFirst({
      where: { articleId: input.articleId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersion = latest ? latest.versionNumber + 1 : 1;

    const version = await this.prisma.contentVersion.create({
      data: {
        articleId: input.articleId,
        versionNumber: nextVersion,
        content: input.content,
        editorId: input.editorId,
      },
    });

    return this.mapToOutput(version);
  }

  /**
   * Get version by ID
   */
  async getVersionById(id: string): Promise<ContentVersionOutput | null> {
    const version = await this.prisma.contentVersion.findUnique({
      where: { id },
    });

    return version ? this.mapToOutput(version) : null;
  }

  /**
   * Get version by article ID and version number
   */
  async getVersion(
    articleId: string,
    versionNumber: number
  ): Promise<ContentVersionOutput | null> {
    const version = await this.prisma.contentVersion.findUnique({
      where: {
        articleId_versionNumber: {
          articleId,
          versionNumber,
        },
      },
    });

    return version ? this.mapToOutput(version) : null;
  }

  /**
   * Get version history for an article
   */
  async getVersionHistory(articleId: string): Promise<ContentVersionOutput[]> {
    const versions = await this.prisma.contentVersion.findMany({
      where: { articleId },
      orderBy: { versionNumber: 'desc' },
    });

    return versions.map((v) => this.mapToOutput(v));
  }

  /**
   * Get latest version for an article
   */
  async getLatestVersion(articleId: string): Promise<ContentVersionOutput | null> {
    const version = await this.prisma.contentVersion.findFirst({
      where: { articleId },
      orderBy: { versionNumber: 'desc' },
    });

    return version ? this.mapToOutput(version) : null;
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    articleId: string,
    versionNumber1: number,
    versionNumber2: number
  ): Promise<VersionComparison | null> {
    const version1 = await this.getVersion(articleId, versionNumber1);
    const version2 = await this.getVersion(articleId, versionNumber2);

    if (!version1 || !version2) {
      return null;
    }

    const differences: string[] = [];
    if (version1.content !== version2.content) {
      differences.push('Content has changed');
    }
    if (version1.editorId !== version2.editorId) {
      differences.push(`Editor changed from ${version1.editorId} to ${version2.editorId}`);
    }

    return {
      version1,
      version2,
      differences,
    };
  }

  /**
   * Restore article to a specific version
   */
  async restoreToVersion(
    articleId: string,
    versionNumber: number,
    editorId: string
  ): Promise<ContentVersionOutput | null> {
    const version = await this.getVersion(articleId, versionNumber);
    if (!version) {
      return null;
    }

    // Create a new version with the restored content
    return this.createVersion({
      articleId,
      content: version.content,
      editorId,
    });
  }

  /**
   * Delete version history for an article (keep latest N versions)
   */
  async pruneVersions(articleId: string, keepLatest: number = 10): Promise<number> {
    const versions = await this.prisma.contentVersion.findMany({
      where: { articleId },
      orderBy: { versionNumber: 'desc' },
      skip: keepLatest,
    });

    const deleted = await this.prisma.contentVersion.deleteMany({
      where: {
        id: {
          in: versions.map((v) => v.id),
        },
      },
    });

    return deleted.count;
  }

  private mapToOutput(version: PrismaContentVersion): ContentVersionOutput {
    return {
      id: version.id,
      articleId: version.articleId,
      versionNumber: version.versionNumber,
      content: version.content,
      editorId: version.editorId,
      createdAt: version.createdAt,
    };
  }
}

