/**
 * Tests for ExplainabilityService
 */

import { ExplainabilityService, CredentialDecision } from '../explainabilityService';
import { PrismaClient } from '@prisma/client';

describe('ExplainabilityService', () => {
  let service: ExplainabilityService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new ExplainabilityService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('explainDecision', () => {
    it('should generate explanation for approved credential', async () => {
      const decision: CredentialDecision = {
        credentialId: 'cred_123',
        decision: 'approved',
        decisionDate: new Date(),
        confidence: 0.95,
        sourceData: [
          {
            id: 'src_1',
            type: 'credential',
            source: 'issuer',
            value: { verified: true },
            confidence: 0.98,
            timestamp: new Date(),
          },
        ],
        transformations: [],
        weightings: [],
      };

      const explanation = await service.explainDecision(decision);

      expect(explanation).toBeDefined();
      expect(explanation.summary).toContain('APPROVED');
      expect(explanation.decision).toEqual(decision);
      expect(explanation.sourceDataBreakdown).toHaveLength(1);
    });

    it('should include reputation factors when available', async () => {
      const decision: CredentialDecision = {
        credentialId: 'cred_123',
        decision: 'approved',
        decisionDate: new Date(),
        confidence: 0.85,
        sourceData: [],
        transformations: [],
        weightings: [],
      };

      // Mock reputation engine
      const mockReputationEngine = {
        getReputationScore: jest.fn().mockResolvedValue({ score: 75 }),
      };

      const serviceWithRep = new ExplainabilityService(prisma, mockReputationEngine);
      const explanation = await serviceWithRep.explainDecision(decision);

      expect(explanation.reputationFactors).toBeDefined();
    });
  });

  describe('formatAsMarkdown', () => {
    it('should format explanation as markdown', async () => {
      const decision: CredentialDecision = {
        credentialId: 'cred_123',
        decision: 'approved',
        decisionDate: new Date(),
        confidence: 0.9,
        sourceData: [
          {
            id: 'src_1',
            type: 'credential',
            source: 'issuer',
            value: { verified: true },
            timestamp: new Date(),
          },
        ],
        transformations: [],
        weightings: [],
      };

      const explanation = await service.explainDecision(decision);
      const markdown = service.formatAsMarkdown(explanation);

      expect(markdown).toContain('# Credential Decision Explanation');
      expect(markdown).toContain('## Summary');
      expect(markdown).toContain('cred_123');
    });
  });
});

