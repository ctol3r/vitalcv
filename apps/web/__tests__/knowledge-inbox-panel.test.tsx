import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgeInboxPanel } from '../components/knowledge-inbox/KnowledgeInboxPanel';

describe('KnowledgeInboxPanel component', () => {
  it('renders honest empty state copy', () => {
    const markup = renderToStaticMarkup(React.createElement(KnowledgeInboxPanel, { items: [] }));
    expect(markup).toContain('Knowledge Inbox is empty');
    expect(markup).toContain('source checks decide what is verified');
    expect(markup).not.toContain('automatically verified');
  });
});
