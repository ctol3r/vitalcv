import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NCINodeService } from '../models/NCINode.js';
import { NCINodeType, PrismaClient } from '@prisma/client';

describe('NCINodeService', () => {
  const upsert = jest.fn();
  const update = jest.fn();
  const findUnique = jest.fn();
  const findMany = jest.fn();

  const prismaMock = {
    nCINode: { upsert, update, findUnique, findMany },
  } as unknown as PrismaClient;

  let service: NCINodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NCINodeService(prismaMock);
  });

  it('registers nodes with normalized DIDs', async () => {
    const node = {
      nodeId: 'node-1',
      did: 'did:example:123',
      nodeType: NCINodeType.CLINICIAN,
      jurisdiction: 'CA',
      metadata: null,
      trustAnchorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    upsert.mockResolvedValue(node);

    const result = await service.registerNode({
      did: ' did:example:123 ',
      nodeType: NCINodeType.CLINICIAN,
      jurisdiction: 'CA',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { did: 'did:example:123' },
      })
    );
    expect(result).toBe(node);
  });

  it('throws for unsupported node types', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service.registerNode({ did: 'did:bad', nodeType: 'UNKNOWN' as any })
    ).rejects.toThrow('Unsupported NCI node type');
  });

  it('updates metadata selectively', async () => {
    const node = {
      nodeId: 'node-2',
      did: 'did:example:222',
      nodeType: NCINodeType.ORG,
      jurisdiction: null,
      metadata: null,
      trustAnchorId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    update.mockResolvedValue(node);

    await service.updateNode('did:example:222', { metadata: { name: 'Org' } });

    expect(update).toHaveBeenCalledWith({
      where: { did: 'did:example:222' },
      data: {
        jurisdiction: undefined,
        metadata: { name: 'Org' },
        trustAnchorId: undefined,
      },
    });
  });
});

