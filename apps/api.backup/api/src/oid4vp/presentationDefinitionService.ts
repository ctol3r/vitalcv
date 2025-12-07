/**
 * DC-003: PresentationDefinition Service
 * Manages storage and retrieval of reusable presentation definitions
 */

import prisma from '../graphql/prisma_client';

export interface PresentationDefinitionInput {
  orgId?: string;
  name?: string;
  json: Record<string, any>;
}

export class PresentationDefinitionService {
  /**
   * Save a presentation definition for reuse
   */
  static async save(input: PresentationDefinitionInput): Promise<string> {
    const definition = await prisma.presentationDefinition.create({
      data: {
        orgId: input.orgId || null,
        name: input.name || null,
        json: input.json as any,
      },
    });
    return definition.id;
  }

  /**
   * Get a presentation definition by ID
   */
  static async getById(id: string): Promise<{ id: string; orgId: string | null; json: any; name: string | null } | null> {
    const definition = await prisma.presentationDefinition.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        json: true,
        name: true,
      },
    });
    return definition;
  }

  /**
   * List presentation definitions for an organization
   */
  static async listByOrg(orgId: string): Promise<Array<{ id: string; name: string | null; createdAt: Date }>> {
    const definitions = await prisma.presentationDefinition.findMany({
      where: { orgId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return definitions;
  }

  /**
   * Delete a presentation definition
   */
  static async delete(id: string, orgId?: string): Promise<boolean> {
    const where: any = { id };
    if (orgId) {
      where.orgId = orgId; // Ensure org ownership
    }

    try {
      await prisma.presentationDefinition.delete({
        where,
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

