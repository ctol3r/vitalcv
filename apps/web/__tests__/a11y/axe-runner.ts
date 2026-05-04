import axe from 'axe-core';
import { JSDOM } from 'jsdom';

const WCAG_22_TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa'] as const;

export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | undefined;
  description: string;
  nodes: { target: string[]; failureSummary: string }[];
}

export async function runAxeOnHtml(html: string, route: string): Promise<AxeViolation[]> {
  const dom = new JSDOM(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${route}</title></head><body>${html}</body></html>`,
    { runScripts: 'dangerously' }
  );
  const { window } = dom;
  // Inject the axe browser bundle into the JSDOM window so axe.run() is available
  window.eval(axe.source);
  const windowAxe = (window as typeof window & { axe: typeof axe }).axe;
  const results = await windowAxe.run(window.document, {
    runOnly: { type: 'tag', values: Array.from(WCAG_22_TAGS) },
  });
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.map((n) => ({
      target: n.target as string[],
      failureSummary: n.failureSummary ?? '',
    })),
  }));
}
