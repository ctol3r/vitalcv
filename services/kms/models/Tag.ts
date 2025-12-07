/**
 * B243A-KMS-003: Tag model
 *
 * Represents a tag that can be assigned to multiple articles.
 * Fields: id, name, description, createdAt, updatedAt
 */

import { PrismaClient, Tag as PrismaTag } from '@prisma/client';

export interface TagInput {
  name: string;
  description?: string;
}

export interface TagOutput {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TagService
 *
 * Manages tags that can be assigned to multiple articles
 */
export class TagService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new tag
   */
  async createTag(input: TagInput): Promise<TagOutput> {
    const tag = await this.prisma.tag.create({
      data: {
        name: input.name,
        description: input.description,
      },
    });

    return this.mapToOutput(tag);
  }

  /**
   * Get tag by ID
   */
  async getTagById(id: string): Promise<TagOutput | null> {
    const tag = await this.prisma.tag.findUnique({
      where: { id },
    });

    return tag ? this.mapToOutput(tag) : null;
  }

  /**
   * Get tag by name
   */
  async getTagByName(name: string): Promise<TagOutput | null> {
    const tag = await this.prisma.tag.findUnique({
      where: { name },
    });

    return tag ? this.mapToOutput(tag) : null;
  }

  /**
   * Update tag
   */
  async updateTag(id: string, input: Partial<TagInput>): Promise<TagOutput> {
    const tag = await this.prisma.tag.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });

    return this.mapToOutput(tag);
  }

  /**
   * Delete tag
   */
  async deleteTag(id: string): Promise<boolean> {
    try {
      await this.prisma.tag.delete({
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
   * List all tags
   */
  async listTags(skip: number = 0, take: number = 100): Promise<TagOutput[]> {
    const tags = await this.prisma.tag.findMany({
      skip,
      take,
      orderBy: { name: 'asc' },
    });

    return tags.map((t) => this.mapToOutput(t));
  }

  /**
   * Search tags by name
   */
  async searchTags(query: string, limit: number = 50): Promise<TagOutput[]> {
    const tags = await this.prisma.tag.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    return tags.map((t) => this.mapToOutput(t));
  }

  /**
   * Get or create tag by name
   */
  async getOrCreateTag(input: TagInput): Promise<TagOutput> {
    const tag = await this.prisma.tag.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        description: input.description,
      },
      update: {
        description: input.description,
      },
    });

    return this.mapToOutput(tag);
  }

  private mapToOutput(tag: PrismaTag): TagOutput {
    return {
      id: tag.id,
      name: tag.name,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}

