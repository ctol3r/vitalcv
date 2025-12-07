import { Router } from 'express';

export const devCi = Router();

devCi.get('/dev/ci', (_req, res) => {
  const branch = process.env.GIT_BRANCH || 'dev';
  const beRepo = process.env.GITHUB_REPO_BACKEND || 'yourorg/chai-vc-platform';
  const feRepo = process.env.GITHUB_REPO_FRONTEND || 'yourorg/v0-vital-cv-frontend-mvp';
  const beBadge = `https://github.com/${beRepo}/actions/workflows/ci.yml/badge.svg?branch=${branch}`;
  const feBadge = `https://github.com/${feRepo}/actions/workflows/ci.yml/badge.svg?branch=${branch}`;
  const vercel = process.env.VERCEL_PREVIEW_URL || '';
  res.json({ ok: true, branch, badges: { backend: beBadge, frontend: feBadge }, vercel });
});

