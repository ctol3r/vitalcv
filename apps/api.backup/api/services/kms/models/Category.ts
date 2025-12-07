/**
 * B243A-KMS-002: Category model
 *
 * Represents a category with nested category support (parentId).
 * Fields: id, name, parentId (nullable), description, sortOrder, createdAt, updatedAt
 */

import { PrismaClient, Category as PrismaCategory } from '@prisma/client';

export interface CategoryInput {
  name: string;
  parentId?: string | null;
  description?: string;
  sortOrder?: number;
}

export interface CategoryOutput {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  children?: CategoryOutput[];
}

/**
 * CategoryService
 *
 * Manages categories with nested hierarchy support
 */
export class CategoryService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new category
   */
  async createCategory(input: CategoryInput): Promise<CategoryOutput> {
    const category = await this.prisma.category.create({
      data: {
        name: input.name,
        parentId: input.parentId ?? null,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    return this.mapToOutput(category);
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string, includeChildren: boolean = false): Promise<CategoryOutput | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: includeChildren,
      },
    });

    return category ? this.mapToOutput(category, includeChildren) : null;
  }

  /**
   * Get category by name
   */
  async getCategoryByName(name: string): Promise<CategoryOutput | null> {
    const category = await this.prisma.category.findFirst({
      where: { name },
    });

    return category ? this.mapToOutput(category) : null;
  }

  /**
   * Update category
   */
  async updateCategory(
    id: string,
    input: Partial<CategoryInput>
  ): Promise<CategoryOutput> {
    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });

    return this.mapToOutput(category);
  }

  /**
   * Delete category (cascades to children if set to null parent)
   */
  async deleteCategory(id: string, reassignChildrenToParent: boolean = false): Promise<boolean> {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: { children: true },
      });

      if (!category) {
        return false;
      }

      if (reassignChildrenToParent && category.children.length > 0) {
        // Reassign children to parent's parent
        await this.prisma.category.updateMany({
          where: { parentId: id },
          data: { parentId: category.parentId },
        });
      }

      await this.prisma.category.delete({
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
   * List all categories
   */
  async listCategories(includeChildren: boolean = false): Promise<CategoryOutput[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: includeChildren,
      },
    });

    return categories.map((c) => this.mapToOutput(c, includeChildren));
  }

  /**
   * Get root categories (no parent)
   */
  async getRootCategories(): Promise<CategoryOutput[]> {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: true,
      },
    });

    return categories.map((c) => this.mapToOutput(c, true));
  }

  /**
   * Get category tree (all descendants)
   */
  async getCategoryTree(id: string): Promise<CategoryOutput | null> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        children: {
          include: {
            children: true, // Recursive include for nested children
          },
        },
      },
    });

    return category ? this.mapToOutput(category, true) : null;
  }

  /**
   * Get all descendants of a category
   */
  async getDescendants(id: string): Promise<CategoryOutput[]> {
    const descendants: CategoryOutput[] = [];
    const category = await this.getCategoryById(id, true);

    if (!category || !category.children) {
      return [];
    }

    const traverse = (cats: CategoryOutput[]) => {
      for (const cat of cats) {
        descendants.push(cat);
        if (cat.children && cat.children.length > 0) {
          traverse(cat.children);
        }
      }
    };

    traverse(category.children);
    return descendants;
  }

  private mapToOutput(
    category: PrismaCategory & { children?: PrismaCategory[] },
    includeChildren: boolean = false
  ): CategoryOutput {
    return {
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      description: category.description,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      ...(includeChildren && category.children
        ? {
            children: category.children.map((c) => this.mapToOutput(c, false)),
          }
        : {}),
    };
  }
}

