#!/usr/bin/env node

import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname;
const appRoot = join(repoRoot, 'apps/web/app');

const PUBLIC_MARKETING = new Set([
  '/', '/concierge', '/contact', '/docs', '/evidence-network',
  '/matcha/experience', '/matcha/hospitals', '/matcha/investors',
  '/matcha/recruiters', '/pilot', '/pricing', '/privacy', '/solutions',
  '/status', '/support', '/terms', '/trust', '/verify/guide',
]);

const FOCUSED_PREFIXES = [
  '/account/recovery', '/apply', '/auth', '/employers', '/get-ready', '/onboarding',
  '/sign-in', '/sign-up', '/signup',
];
const PRODUCT_PREFIXES = [
  '/clinician', '/holder', '/opportunities', '/packet', '/passport', '/profile',
  '/receipt', '/review', '/snapshot', '/verify',
];
const WORKFLOW_PREFIXES = [
  '/activation', '/activity', '/admin', '/analytics-foundation', '/autopilot',
  '/career-intelligence', '/career-map', '/demo', '/design', '/dev', '/dossier',
  '/ecosystem', '/employer', '/file', '/inbox', '/investigate', '/issuer',
  '/mobile', '/network', '/ops', '/professional-growth', '/recruiter', '/roi',
  '/search', '/status/technical',
];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '_archive' || entry.name === 'api' || entry.name.startsWith('.')) return [];
    const target = join(dir, entry.name);
    if (entry.isDirectory()) return walk(target);
    return entry.name === 'page.tsx' ? [target] : [];
  });
}

function routeFromFile(file) {
  const parts = relative(appRoot, file).split(sep).slice(0, -1);
  const visible = parts.filter((part) => !(part.startsWith('(') && part.endsWith(')')));
  if (visible.length === 0) return '/';
  return `/${visible.map((part) => {
    if (part.startsWith('[[...')) return '*';
    if (part.startsWith('[...')) return '*';
    if (part.startsWith('[') && part.endsWith(']')) return `:${part.slice(1, -1)}`;
    return part;
  }).join('/')}`;
}

function startsWithAny(route, prefixes) {
  return prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function classify(route) {
  if (
    PUBLIC_MARKETING.has(route) ||
    route.startsWith('/directory/') ||
    route.startsWith('/for/') ||
    route.startsWith('/legal/') ||
    route.startsWith('/p/') ||
    route.startsWith('/trust/')
  ) {
    return { surface: 'public', density: 'marketing' };
  }
  if (startsWithAny(route, FOCUSED_PREFIXES)) {
    return { surface: 'public-or-auth', density: 'focused-form' };
  }
  if (startsWithAny(route, PRODUCT_PREFIXES)) {
    return { surface: 'clinician-product', density: 'product' };
  }
  if (startsWithAny(route, WORKFLOW_PREFIXES)) {
    return { surface: 'workflow-or-ops', density: 'workflow' };
  }
  throw new Error(`Unclassified active route: ${route}`);
}

const inventory = walk(appRoot)
  .map((file) => {
    const route = routeFromFile(file);
    const classification = classify(route);
    return {
      route,
      source: relative(repoRoot, file),
      ...classification,
      capture: route.includes(':') || route.includes('*') ? 'fixture-required' : 'direct',
    };
  })
  .sort((a, b) => a.route.localeCompare(b.route));

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
} else {
  process.stdout.write(`Active page routes: ${inventory.length}\n\n`);
  process.stdout.write('| Route | Surface | Density | Capture | Source |\n');
  process.stdout.write('| --- | --- | --- | --- | --- |\n');
  for (const item of inventory) {
    process.stdout.write(`| \`${item.route}\` | ${item.surface} | ${item.density} | ${item.capture} | \`${item.source}\` |\n`);
  }
}
