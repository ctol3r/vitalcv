import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgeInboxPanel } from '../components/knowledge-inbox/KnowledgeInboxPanel';

describe('KnowledgeInboxPanel component', () => {
  it('renders honest empty state copy', () => {
    const markup = renderToStaticMarkup(React.createElement(KnowledgeInboxPanel, { items: [] }));
    expect(markup).toContain('Knowledge Inbox is empty');
    expect(markup).toMatch(/Source checks decide what becomes verified/i);
    expect(markup).not.toContain('automatically verified');
    expect(markup).not.toContain(['verified', 'by', 'AI'].join(' '));
  });

  it('does not render raw enum tags or the old Accept-to-Profile CTA', () => {
    const markup = renderToStaticMarkup(React.createElement(KnowledgeInboxPanel, { items: [] }));
    expect(markup).not.toMatch(/>USER_ENTERED</);
    expect(markup).not.toMatch(/>INFERRED</);
    expect(markup).not.toContain('Accept to Profile');
  });
});
