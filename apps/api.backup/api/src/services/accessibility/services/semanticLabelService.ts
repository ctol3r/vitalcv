/**
 * B242A-ACC-006: SemanticLabel service
 *
 * Manages ARIA labels and descriptions for UI elements.
 */

import prisma from '../../../graphql/prisma_client';
import {
  SemanticLabelData,
  CreateSemanticLabelInput,
  UpdateSemanticLabelInput,
} from '../models/SemanticLabel';

export class SemanticLabelService {
  /**
   * Get semantic label by component ID and locale
   */
  async getLabel(componentId: string, locale: string = 'en-US'): Promise<SemanticLabelData | null> {
    return prisma.semanticLabel.findUnique({
      where: {
        componentId_locale: {
          componentId,
          locale,
        },
      },
    });
  }

  /**
   * Get all labels for a component across all locales
   */
  async getLabelsByComponent(componentId: string): Promise<SemanticLabelData[]> {
    return prisma.semanticLabel.findMany({
      where: { componentId },
      orderBy: { locale: 'asc' },
    });
  }

  /**
   * Get all labels for a specific locale
   */
  async getLabelsByLocale(locale: string): Promise<SemanticLabelData[]> {
    return prisma.semanticLabel.findMany({
      where: { locale },
      orderBy: { componentId: 'asc' },
    });
  }

  /**
   * Create or update a semantic label
   */
  async upsertLabel(input: CreateSemanticLabelInput): Promise<SemanticLabelData> {
    const locale = input.locale ?? 'en-US';

    return prisma.semanticLabel.upsert({
      where: {
        componentId_locale: {
          componentId: input.componentId,
          locale,
        },
      },
      create: {
        componentId: input.componentId,
        defaultLabel: input.defaultLabel,
        locale,
        description: input.description,
      },
      update: {
        defaultLabel: input.defaultLabel,
        description: input.description,
      },
    });
  }

  /**
   * Update an existing semantic label
   */
  async updateLabel(
    componentId: string,
    locale: string,
    input: UpdateSemanticLabelInput
  ): Promise<SemanticLabelData> {
    return prisma.semanticLabel.update({
      where: {
        componentId_locale: {
          componentId,
          locale,
        },
      },
      data: {
        ...(input.defaultLabel !== undefined && { defaultLabel: input.defaultLabel }),
        ...(input.description !== undefined && { description: input.description }),
      },
    });
  }

  /**
   * Delete a semantic label
   */
  async deleteLabel(componentId: string, locale: string): Promise<void> {
    await prisma.semanticLabel.delete({
      where: {
        componentId_locale: {
          componentId,
          locale,
        },
      },
    }).catch(() => {
      // Ignore if label doesn't exist
    });
  }

  /**
   * Get label with fallback to default locale if not found
   */
  async getLabelWithFallback(
    componentId: string,
    locale: string = 'en-US'
  ): Promise<SemanticLabelData | null> {
    // Try requested locale first
    let label = await this.getLabel(componentId, locale);

    // Fallback to en-US if not found and locale is not en-US
    if (!label && locale !== 'en-US') {
      label = await this.getLabel(componentId, 'en-US');
    }

    return label;
  }
}

export const semanticLabelService = new SemanticLabelService();

