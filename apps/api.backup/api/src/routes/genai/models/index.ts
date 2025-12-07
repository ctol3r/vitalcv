/**
 * B131F-GENAI-003: ModelCard registry & API
 *
 * API endpoints for managing GenAI model cards:
 * - GET /genai/models - List all model cards
 * - GET /genai/models/:id - Get model card details
 *
 * No secrets are exposed in API responses.
 */

import { Router, Request, Response } from 'express';
import * as ModelCardService from '../../../../../services/genai/models/ModelCard';
import * as RiskCategoryService from '../../../../../services/genai/models/RiskCategory';

const router = Router();

/**
 * GET /genai/models
 * List all registered model cards
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeRisks = req.query.includeRisks !== 'false';
    const modelCards = await ModelCardService.getAllModelCards(includeRisks);

    // Get decision counts and override counts for each model
    const modelCardsWithStats = await Promise.all(
      modelCards.map(async (card) => {
        const decisionCount = await ModelCardService.getDecisionCountForModel(card.modelId);
        const overrideCount = await ModelCardService.getOverrideCountForModel(card.modelId);
        const overrideRate = decisionCount > 0 ? overrideCount / decisionCount : 0;

        return {
          id: card.id,
          modelId: card.modelId,
          provider: card.provider,
          version: card.version,
          trainingDataSummary: card.trainingDataSummary,
          mitigations: card.mitigations,
          metadata: card.metadata,
          isActive: card.isActive,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          risks: card.risks?.map((risk) => ({
            id: risk.id,
            riskCategory: risk.riskCategory,
            severity: risk.severity,
            notes: risk.notes,
          })),
          stats: {
            decisionCount,
            overrideCount,
            overrideRate,
          },
        };
      })
    );

    res.json({
      success: true,
      data: modelCardsWithStats,
      count: modelCardsWithStats.length,
    });
  } catch (error) {
    console.error('[ModelCard API] Error listing model cards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list model cards',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /genai/models/:id
 * Get model card details by modelId
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const modelId = req.params.id;
    const includeRisks = req.query.includeRisks !== 'false';

    const modelCard = await ModelCardService.getModelCardByModelId(modelId, includeRisks);

    if (!modelCard) {
      return res.status(404).json({
        success: false,
        error: 'Model card not found',
        message: `Model card with ID "${modelId}" not found`,
      });
    }

    // Get decision counts and override counts
    const decisionCount = await ModelCardService.getDecisionCountForModel(modelId);
    const overrideCount = await ModelCardService.getOverrideCountForModel(modelId);
    const overrideRate = decisionCount > 0 ? overrideCount / decisionCount : 0;

    res.json({
      success: true,
      data: {
        id: modelCard.id,
        modelId: modelCard.modelId,
        provider: modelCard.provider,
        version: modelCard.version,
        trainingDataSummary: modelCard.trainingDataSummary,
        mitigations: modelCard.mitigations,
        metadata: modelCard.metadata,
        isActive: modelCard.isActive,
        createdAt: modelCard.createdAt,
        updatedAt: modelCard.updatedAt,
        risks: modelCard.risks?.map((risk) => ({
          id: risk.id,
          riskCategory: risk.riskCategory,
          severity: risk.severity,
          notes: risk.notes,
        })),
        stats: {
          decisionCount,
          overrideCount,
          overrideRate,
        },
      },
    });
  } catch (error) {
    console.error('[ModelCard API] Error getting model card:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model card',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /genai/models/:id/risks
 * Get risk categories for a model
 */
router.get('/:id/risks', async (req: Request, res: Response) => {
  try {
    const modelId = req.params.id;
    const modelCard = await ModelCardService.getModelCardByModelId(modelId, true);

    if (!modelCard) {
      return res.status(404).json({
        success: false,
        error: 'Model card not found',
        message: `Model card with ID "${modelId}" not found`,
      });
    }

    res.json({
      success: true,
      data: modelCard.risks?.map((risk) => ({
        id: risk.id,
        riskCategory: risk.riskCategory,
        severity: risk.severity,
        notes: risk.notes,
      })),
      count: modelCard.risks?.length || 0,
    });
  } catch (error) {
    console.error('[ModelCard API] Error getting model risks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get model risks',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

