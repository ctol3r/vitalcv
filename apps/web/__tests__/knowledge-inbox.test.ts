import { describe, expect, it } from 'vitest';
import { classifyInboxItem } from '../lib/knowledge-inbox/classifyInboxItem';

describe('Knowledge Inbox Classification (GOD-3)', () => {
  it('residency text classifies as training', () => {
    const result = classifyInboxItem('Completed residency at Mass General');
    expect(result.itemType).toBe('training');
    expect(result.suggestedProfileSection).toBe('Postgraduate Training');
  });

  it('fellowship text classifies as training', () => {
    const result = classifyInboxItem('Cardiology fellowship');
    expect(result.itemType).toBe('training');
  });

  it('DOI/PubMed text classifies as publication/research', () => {
    const result = classifyInboxItem('New paper on PubMed regarding cardiology');
    expect(result.itemType).toBe('publication');
    expect(result.suggestedGraphNode).toBe('Credential Claim (Publication)');
  });

  it('board certification text is not VERIFIED', () => {
    const result = classifyInboxItem('I am board certified in pediatrics');
    expect(result.itemType).toBe('boardCertification');
    expect(result.limitationNote).toContain('requires ABMS/Specialty board source evidence');
    expect(result.nextAction).toContain('Queue for source evidence');
  });

  it('license text is not VERIFIED without source', () => {
    const result = classifyInboxItem('Medical license #12345 in CA');
    expect(result.itemType).toBe('license');
    expect(result.limitationNote).toContain('Requires state board Primary Source Verification');
  });

  it('unknown text remains unknown', () => {
    const result = classifyInboxItem('I like to play golf on weekends');
    expect(result.itemType).toBe('unknown');
    expect(result.suggestedGraphNode).toBe('Unknown');
  });
});
