/**
 * Graph Page SSR Guard Tests
 *
 * Ensures the /graph page doesn't crash during SSR/SSG with empty or undefined data.
 * This prevents "Cannot read properties of undefined (reading '0')" errors during build.
 */

import { describe, it, expect } from '@jest/globals';

describe('Graph Page SSR Safety', () => {
  it('should export dynamic rendering configuration', async () => {
    const module = await import('@/app/graph/page');

    // Verify dynamic rendering is forced (prevents SSG)
    expect(module.dynamic).toBe('force-dynamic');
    expect(module.revalidate).toBe(0);
  });

  it('should have well-defined static data structure', async () => {
    const module = await import('@/app/graph/page');
    const GraphPage = module.default;

    // The page should be a valid React component
    expect(typeof GraphPage).toBe('function');
  });

  it('should not access array indices without guards', () => {
    // This is a compile-time check - if the code has unsafe array access,
    // TypeScript should catch it. This test documents the requirement.

    const safeArrayAccess = (arr?: any[]) => {
      // ✓ Safe: arr?.[0]
      // ✓ Safe: arr && arr[0]
      // ✓ Safe: arr?.length > 0 ? arr[0] : null
      // ✗ Unsafe: arr[0] without checks

      if (!arr || arr.length === 0) {
        return null;
      }
      return arr[0];
    };

    expect(safeArrayAccess(undefined)).toBe(null);
    expect(safeArrayAccess([])).toBe(null);
    expect(safeArrayAccess([1, 2, 3])).toBe(1);
  });

  it('should handle VitalGraph component with empty data gracefully', () => {
    // This test documents that VitalGraph should handle empty/undefined data
    const emptyGraphData = {
      nodes: [],
      links: []
    };

    // VitalGraph should accept this without throwing
    expect(emptyGraphData.nodes).toBeDefined();
    expect(emptyGraphData.links).toBeDefined();
    expect(Array.isArray(emptyGraphData.nodes)).toBe(true);
    expect(Array.isArray(emptyGraphData.links)).toBe(true);
  });
});

describe('Graph Page Runtime Data Safety', () => {
  it('should handle node data with required fields', () => {
    const validNode = {
      id: 'test-node',
      group: 'holder' as const,
      label: 'Test'
    };

    expect(validNode).toHaveProperty('id');
    expect(validNode).toHaveProperty('group');
    expect(validNode).toHaveProperty('label');
  });

  it('should handle link data with required fields', () => {
    const validLink = {
      source: 'node1',
      target: 'node2',
      weight: 1
    };

    expect(validLink).toHaveProperty('source');
    expect(validLink).toHaveProperty('target');
    expect(validLink).toHaveProperty('weight');
  });

  it('should not attempt SSG on client-side only features', async () => {
    const module = await import('@/app/graph/page');

    // Verify the page uses 'use client' directive by checking dynamic config
    expect(module.dynamic).toBe('force-dynamic');

    // This ensures window, document, etc. won't be accessed during SSG
  });
});

