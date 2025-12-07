import { describe, expect, it } from '@jest/globals';

import {
  assertParentCompatibility,
  canAttachToParent,
  createWorkforceDemandNode,
  deriveNodeKey,
} from '../models/WorkforceDemandNode.js';

describe('WorkforceDemandNode model', () => {
  it('creates a department node without requiring a parent', () => {
    const node = createWorkforceDemandNode({
      id: 'dept-icu',
      orgId: 'org-1',
      nodeType: 'DEPARTMENT',
      label: 'ICU',
    });

    expect(node.nodeType).toBe('DEPARTMENT');
    expect(node.parentNodeId).toBeUndefined();
    expect(node.headcountTarget).toBe(0);
  });

  it('rejects requirement nodes that are missing a parent', () => {
    expect(() =>
      createWorkforceDemandNode({
        id: 'req-1',
        orgId: 'org-1',
        nodeType: 'REQUIREMENT',
        label: 'ICU RN Bundle',
      })
    ).toThrow(/REQUIREMENT nodes must have a parent/i);
  });

  it('validates allowed parent relationships', () => {
    expect(canAttachToParent('ROLE', 'SHIFT')).toBe(true);
    expect(canAttachToParent('SHIFT', 'ROLE')).toBe(false);
    expect(() => assertParentCompatibility('SERVICE', 'DEPARTMENT')).toThrow(/cannot attach/i);
  });

  it('derives stable node keys', () => {
    const key = deriveNodeKey({
      orgId: 'org-1',
      nodeType: 'ROLE',
      label: 'Night Shift RN',
    });
    expect(key).toBe('org-1:ROLE:night_shift_rn');
  });
});


