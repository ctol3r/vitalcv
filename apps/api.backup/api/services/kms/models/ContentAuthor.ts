/**
 * B243A-KMS-005: ContentAuthor model
 *
 * Represents an author used to credit content articles.
 * Fields: id, name, profilePictureUrl, bio, userId (optional), createdAt
 */

import { PrismaClient, ContentAuthor as PrismaContentAuthor } from '@prisma/client';

export interface ContentAuthorInput {
  name: string;
  profilePictureUrl?: string;
  bio?: string;
  userId?: string | null;
}

export interface ContentAuthorOutput {
  id: string;
  name: string;
  profilePictureUrl: string | null;
  bio: string | null;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ContentAuthorService
 *
 * Manages content authors used to credit articles
 */
export class ContentAuthorService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new author
   */
  async createAuthor(input: ContentAuthorInput): Promise<ContentAuthorOutput> {
    const author = await this.prisma.contentAuthor.create({
      data: {
        name: input.name,
        profilePictureUrl: input.profilePictureUrl,
        bio: input.bio,
        userId: input.userId ?? null,
      },
    });

    return this.mapToOutput(author);
  }

  /**
   * Get author by ID
   */
  async getAuthorById(id: string): Promise<ContentAuthorOutput | null> {
    const author = await this.prisma.contentAuthor.findUnique({
      where: { id },
    });

    return author ? this.mapToOutput(author) : null;
  }

  /**
   * Get author by user ID
   */
  async getAuthorByUserId(userId: string): Promise<ContentAuthorOutput | null> {
    const author = await this.prisma.contentAuthor.findUnique({
      where: { userId },
    });

    return author ? this.mapToOutput(author) : null;
  }

  /**
   * Update author
   */
  async updateAuthor(
    id: string,
    input: Partial<ContentAuthorInput>
  ): Promise<ContentAuthorOutput> {
    const author = await this.prisma.contentAuthor.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.profilePictureUrl !== undefined && { profilePictureUrl: input.profilePictureUrl }),
        ...(input.bio !== undefined && { bio: input.bio }),
        ...(input.userId !== undefined && { userId: input.userId }),
      },
    });

    return this.mapToOutput(author);
  }

  /**
   * Delete author
   */
  async deleteAuthor(id: string): Promise<boolean> {
    try {
      await this.prisma.contentAuthor.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all authors
   */
  async listAuthors(skip: number = 0, take: number = 100): Promise<ContentAuthorOutput[]> {
    const authors = await this.prisma.contentAuthor.findMany({
      skip,
      take,
      orderBy: { name: 'asc' },
    });

    return authors.map((a) => this.mapToOutput(a));
  }

  /**
   * Search authors by name
   */
  async searchAuthors(query: string, limit: number = 50): Promise<ContentAuthorOutput[]> {
    const authors = await this.prisma.contentAuthor.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    return authors.map((a) => this.mapToOutput(a));
  }

  /**
   * Get or create author by user ID
   */
  async getOrCreateAuthorByUserId(
    userId: string,
    defaultName: string
  ): Promise<ContentAuthorOutput> {
    const existing = await this.getAuthorByUserId(userId);
    if (existing) {
      return existing;
    }

    return this.createAuthor({
      name: defaultName,
      userId,
    });
  }

  private mapToOutput(author: PrismaContentAuthor): ContentAuthorOutput {
    return {
      id: author.id,
      name: author.name,
      profilePictureUrl: author.profilePictureUrl,
      bio: author.bio,
      userId: author.userId,
      createdAt: author.createdAt,
      updatedAt: author.updatedAt,
    };
  }
}

