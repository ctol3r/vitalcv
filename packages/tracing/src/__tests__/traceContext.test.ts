/**
 * Tests for W3C Trace Context parsing and generation
 */

import { describe, it, expect } from 'vitest';
import {
  parseTraceparent,
  generateTraceparent,
  generateTraceId,
  generateSpanId,
  generateTraceContext,
  createChildSpan,
} from '../traceContext';

describe('Trace Context', () => {
  describe('parseTraceparent', () => {
    it('should parse valid traceparent header', () => {
      const header = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      const result = parseTraceparent(header);

      expect(result).toEqual({
        trace_id: '0af7651916cd43dd8448eb211c80319c',
        span_id: 'b7ad6b7169203331',
        trace_flags: '01',
      });
    });

    it('should return null for invalid version', () => {
      const header = '01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      expect(parseTraceparent(header)).toBeNull();
    });

    it('should return null for all-zero trace ID', () => {
      const header = '00-00000000000000000000000000000000-b7ad6b7169203331-01';
      expect(parseTraceparent(header)).toBeNull();
    });

    it('should return null for all-zero span ID', () => {
      const header = '00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01';
      expect(parseTraceparent(header)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseTraceparent('invalid')).toBeNull();
      expect(parseTraceparent('')).toBeNull();
      expect(parseTraceparent('00-abc-def-01')).toBeNull();
    });
  });

  describe('generateTraceparent', () => {
    it('should generate valid traceparent header', () => {
      const context = {
        trace_id: '0af7651916cd43dd8448eb211c80319c',
        span_id: 'b7ad6b7169203331',
        trace_flags: '01',
      };

      const header = generateTraceparent(context);
      expect(header).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    });
  });

  describe('generateTraceId', () => {
    it('should generate valid 32-character hex trace ID', () => {
      const traceId = generateTraceId();

      expect(traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(traceId).not.toBe('00000000000000000000000000000000');
    });

    it('should generate unique trace IDs', () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateSpanId', () => {
    it('should generate valid 16-character hex span ID', () => {
      const spanId = generateSpanId();

      expect(spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(spanId).not.toBe('0000000000000000');
    });

    it('should generate unique span IDs', () => {
      const id1 = generateSpanId();
      const id2 = generateSpanId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('generateTraceContext', () => {
    it('should generate valid trace context with sampled flag', () => {
      const context = generateTraceContext(true);

      expect(context.trace_id).toMatch(/^[0-9a-f]{32}$/);
      expect(context.span_id).toMatch(/^[0-9a-f]{16}$/);
      expect(context.trace_flags).toBe('01');
    });

    it('should generate valid trace context with unsampled flag', () => {
      const context = generateTraceContext(false);

      expect(context.trace_flags).toBe('00');
    });
  });

  describe('createChildSpan', () => {
    it('should create child span preserving trace_id and trace_flags', () => {
      const parent = {
        trace_id: '0af7651916cd43dd8448eb211c80319c',
        span_id: 'b7ad6b7169203331',
        trace_flags: '01',
      };

      const child = createChildSpan(parent);

      expect(child.trace_id).toBe(parent.trace_id);
      expect(child.trace_flags).toBe(parent.trace_flags);
      expect(child.span_id).not.toBe(parent.span_id);
      expect(child.span_id).toMatch(/^[0-9a-f]{16}$/);
    });
  });
});
