import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import VelocityPage from '../app/velocity/page';

describe('/velocity page', () => {
  it('renders the public dashboard shell before client-side data loads', () => {
    const markup = renderToStaticMarkup(React.createElement(VelocityPage));

    expect(markup).toContain('Velocity Dashboard');
    expect(markup).toContain('Time-to-Start Intelligence');
    expect(markup).toContain('animate-spin');
  });
});
