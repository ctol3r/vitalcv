import { PrismaClient } from '@prisma/client';
import prisma from '../../../graphql/prisma_client';
import { persistDiscoverItem } from '../models';
import { append as appendPulse } from '../../pulse/service';
import { log } from '../../../obs/logger';

type PubmedArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt?: string | null;
};

async function fetchPubmedIds(specialty: string, limit: number): Promise<string[]> {
  const encoded = encodeURIComponent(`${specialty}[MeSH Terms]`);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&sort=date&retmode=json&retmax=${limit}`;
  const resp = await fetch(searchUrl, { method: 'GET' });
  if (!resp.ok) {
    throw new Error(`pubmed search failed (${resp.status})`);
  }
  const json = (await resp.json()) as any;
  const ids = (json?.esearchresult?.idlist ?? []) as string[];
  return ids.slice(0, limit);
}

async function fetchPubmedSummaries(ids: string[]): Promise<PubmedArticle[]> {
  if (!ids.length) return [];
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`;
  const resp = await fetch(summaryUrl, { method: 'GET' });
  if (!resp.ok) throw new Error(`pubmed summary failed (${resp.status})`);
  const json = (await resp.json()) as any;
  const result = json?.result ?? {};

  return ids
    .map((id) => {
      const entry = result[id] ?? {};
      const title = String(entry.title || '').trim();
      if (!title) return null;
      const pubdate = String(entry.pubdate || entry.pubDate || '').trim();
      const summary = String(entry.sortfirstauthor || entry.fulljournalname || entry.source || '').trim();
      return {
        id,
        title,
        summary: summary || 'Clinical research update',
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        publishedAt: pubdate ? new Date(pubdate).toISOString() : null,
      } satisfies PubmedArticle;
    })
    .filter(Boolean) as PubmedArticle[];
}

export async function ingestPubmedBySpecialty(
  specialty: string,
  options?: { limit?: number; client?: PrismaClient; calmMs?: number },
): Promise<PubmedArticle[]> {
  const limit = Math.max(1, Math.min(options?.limit ?? 5, 20));
  const client = options?.client ?? prisma;
  const ids = await fetchPubmedIds(specialty, limit).catch((error: Error) => {
    log('warn', 'pubmed_search_failed', { error: error.message, specialty });
    return [];
  });
  if (!ids.length) return [];

  const summaries = await fetchPubmedSummaries(ids).catch((error: Error) => {
    log('warn', 'pubmed_summary_failed', { error: error.message, specialty });
    return [];
  });

  let createdCount = 0;
  for (const article of summaries) {
    const { created } = await persistDiscoverItem(
      {
        source: 'pubmed',
        sourceId: article.id,
        specialty,
        title: article.title,
        summary: article.summary,
        url: article.url,
        publishedAt: article.publishedAt,
        metadata: { kind: 'pubmed', ingestedFrom: 'pubmed.esummary' },
      },
      client,
    );
    if (created) createdCount += 1;
  }

  if (createdCount > 0) {
    await appendPulse(
      {
        type: 'discover.pubmed',
        title: 'New clinical signals',
        message: `${createdCount} new PubMed item${createdCount === 1 ? '' : 's'} for ${specialty}`,
        severity: 'info',
        source: 'pubmed',
        scope: specialty,
        metadata: { specialty, createdCount },
      },
      { calmMs: options?.calmMs, client },
    );
  }

  return summaries;
}

export function schedulePubmedIngest(options: {
  specialties: string[];
  intervalMinutes?: number;
  limit?: number;
  client?: PrismaClient;
}) {
  const intervalMinutes = Math.max(5, options.intervalMinutes ?? 60);
  const calmMs = intervalMinutes * 60 * 1000;
  const run = async () => {
    for (const specialty of options.specialties) {
      await ingestPubmedBySpecialty(specialty, {
        limit: options.limit,
        calmMs,
        client: options.client,
      });
    }
  };

  // Start immediately, then on interval.
  void run();
  const timer = setInterval(() => {
    void run();
  }, intervalMinutes * 60 * 1000);
  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }

  log('info', 'pubmed_ingest_scheduled', {
    specialties: options.specialties,
    intervalMinutes,
    limit: options.limit ?? 5,
  });

  return {
    stop: () => clearInterval(timer),
  };
}

export function configurePubmedIngestFromEnv() {
  const rawSpecialties = String(process.env.PUBMED_SPECIALTIES || '').trim();
  if (!rawSpecialties) return null;

  const specialties = rawSpecialties
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!specialties.length) return null;

  const intervalMinutes = Number(process.env.PUBMED_INGEST_INTERVAL_MINUTES || '') || undefined;
  const limit = Number(process.env.PUBMED_INGEST_LIMIT || '') || undefined;

  return schedulePubmedIngest({ specialties, intervalMinutes, limit });
}
