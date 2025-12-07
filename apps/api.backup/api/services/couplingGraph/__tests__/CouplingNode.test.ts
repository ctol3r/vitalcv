import { describe, expect, it } from '@jest/globals';
import {
  createCouplingNode,
  isDepartmentNode,
  isRoleNode,
  isPrivilegeSetNode,
  isEnrollmentPoolNode,
  isEhrDomainNode,
  isStateRegionNode,
  isServiceLineNode,
  type CouplingNode,
} from '../models/CouplingNode.js';

describe('CouplingNode', () => {
  const baseNode: CouplingNode = {
    id: 'node-1',
    nodeType: 'DEPARTMENT',
    name: 'Emergency Department',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  describe('createCouplingNode', () => {
    it('should create a valid coupling node', () => {
      const node = createCouplingNode({
        id: 'node-1',
        nodeType: 'DEPARTMENT',
        name: 'Emergency Department',
      });

      expect(node.id).toBe('node-1');
      expect(node.nodeType).toBe('DEPARTMENT');
      expect(node.name).toBe('Emergency Department');
      expect(node.createdAt).toBeInstanceOf(Date);
      expect(node.updatedAt).toBeInstanceOf(Date);
    });

    it('should accept optional metadata', () => {
      const node = createCouplingNode({
        id: 'node-1',
        nodeType: 'DEPARTMENT',
        name: 'Emergency Department',
        metadata: { capacity: 50, location: 'Building A' },
      });

      expect(node.metadata).toEqual({ capacity: 50, location: 'Building A' });
    });

    it('should reject invalid node type', () => {
      expect(() =>
        createCouplingNode({
          id: 'node-1',
          nodeType: 'INVALID_TYPE' as any,
          name: 'Test Node',
        })
      ).toThrow();
    });

    it('should reject missing required fields', () => {
      expect(() =>
        createCouplingNode({
          id: '',
          nodeType: 'DEPARTMENT',
          name: 'Test Node',
        })
      ).toThrow();

      expect(() =>
        createCouplingNode({
          id: 'node-1',
          nodeType: 'DEPARTMENT',
          name: '',
        })
      ).toThrow();
    });
  });

  describe('node type predicates', () => {
    it('should identify department nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'DEPARTMENT',
      });
      expect(isDepartmentNode(node)).toBe(true);
      expect(isRoleNode(node)).toBe(false);
    });

    it('should identify role nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'ROLE',
      });
      expect(isRoleNode(node)).toBe(true);
      expect(isDepartmentNode(node)).toBe(false);
    });

    it('should identify privilege set nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'PRIVILEGE_SET',
      });
      expect(isPrivilegeSetNode(node)).toBe(true);
    });

    it('should identify enrollment pool nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'ENROLLMENT_POOL',
      });
      expect(isEnrollmentPoolNode(node)).toBe(true);
    });

    it('should identify EHR domain nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'EHR_DOMAIN',
      });
      expect(isEhrDomainNode(node)).toBe(true);
    });

    it('should identify state region nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'STATE_REGION',
      });
      expect(isStateRegionNode(node)).toBe(true);
    });

    it('should identify service line nodes', () => {
      const node = createCouplingNode({
        ...baseNode,
        nodeType: 'SERVICE_LINE',
      });
      expect(isServiceLineNode(node)).toBe(true);
    });
  });
});

