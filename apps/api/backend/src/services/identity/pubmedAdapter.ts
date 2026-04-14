/**
 * Wave 12: PubMed E-utilities adapter.
 *
 * Queries PubMed by author name + affiliation, returning structured
 * publication metadata. Maps results to a clinician entity via NPI + name
 * matching. Uses the NCBI E-utilities esearch → efetch pipeline.
 *
 * API docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/
 *
 * Zero PHI: only publication metadata (titles, PMIDs, journals) is stored.
 */

import { log } from '../../obs/logger';
import type { PubMedArticle, PubMedSearchResult } from '@vitalcv/domain-common';

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 50;

interface ESearchResult {
  esearchresult?: {
    idlist?: string[];
    count?: string;
  };
}

interface EFetchArticle {
  uid: string;
  title?: string;
  fulljournalname?: string;
  sortpubdate?: string;
  elocationid?: string;
  authors?: Array<{ name: string; authtype: string }>;
}

interface ESummaryResult {
  result?: Record<string, EFetchArticle>;
}

function buildSearchQuery(name: string, affiliation: string): string {
  // PubMed author search: "LastName FirstInitial"[Author] AND affiliation[Affiliation]
  const authorTerm = `${name}[Author]`;
  const affiliationTerm = affiliation ? ` AND ${affiliation}[Affiliation]` : '';
  return `${authorTerm}${affiliationTerm}`;
}

function resolveAuthorPosition(
  authors: Array<{ name: string; authtype: string }> | undefined,
  clinicianName: string,
): PubMedArticle['authorPosition'] {
  if (!authors || authors.length === 0) return 'middle';

  const normalizedName = clinicianName.toLowerCase().trim();
  const firstAuthor = authors[0]?.name?.toLowerCase() ?? '';
  const lastAuthor = authors[authors.length - 1]?.name?.toLowerCase() ?? '';

  if (firstAuthor.includes(normalizedName) || normalizedName.includes(firstAuthor.split(' ')[0] ?? '')) {
    return 'first';
  }
  if (lastAuthor.includes(normalizedName) || normalizedName.includes(lastAuthor.split(' ')[0] ?? '')) {
    return 'last';
  }
  return 'middle';
}

function parseDoi(elocationid: string | undefined): string | undefined {
  if (!elocationid) return undefined;
  const match = elocationid.match(/doi:\s*(.+)/i);
  return match?.[1]?.trim();
}

async function fetchWithTimeout(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class PubMedAdapter {
  /**
   * Search PubMed by author name and affiliation.
   * Returns structured publication records mapped to the clinician entity.
   */
  async searchByAuthor(
    name: string,
    affiliation: string,
    clinicianId: string,
    npi: string,
  ): Promise<PubMedSearchResult> {
    const query = buildSearchQuery(name, affiliation);
    const fetchedAt = new Date().toISOString();

    try {
      // Step 1: ESearch — get PMIDs
      const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${MAX_RESULTS}&retmode=json`;
      const searchRes = await fetchWithTimeout(searchUrl);

      if (!searchRes.ok) {
        log('warn', 'pubmed_esearch_failed', { status: searchRes.status, query });
        return Object.freeze({ clinicianId, npi, query, articles: [], totalCount: 0, fetchedAt });
      }

      const searchData = (await searchRes.json()) as ESearchResult;
      const pmids = searchData.esearchresult?.idlist ?? [];
      const totalCount = parseInt(searchData.esearchresult?.count ?? '0', 10);

      if (pmids.length === 0) {
        return Object.freeze({ clinicianId, npi, query, articles: [], totalCount: 0, fetchedAt });
      }

      // Step 2: ESummary — get article metadata
      const summaryUrl = `${EUTILS_BASE}/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
      const summaryRes = await fetchWithTimeout(summaryUrl);

      if (!summaryRes.ok) {
        log('warn', 'pubmed_esummary_failed', { status: summaryRes.status, pmidCount: pmids.length });
        return Object.freeze({ clinicianId, npi, query, articles: [], totalCount, fetchedAt });
      }

      const summaryData = (await summaryRes.json()) as ESummaryResult;
      const resultMap = summaryData.result ?? {};

      const articles: PubMedArticle[] = pmids
        .map((pmid) => {
          const article = resultMap[pmid];
          if (!article || !article.title) return null;

          const doi = parseDoi(article.elocationid);

          const record: PubMedArticle = Object.freeze({
            pmid,
            title: article.title,
            journal: article.fulljournalname ?? 'Unknown',
            publicationDate: article.sortpubdate?.slice(0, 10) ?? 'Unknown',
            authorPosition: resolveAuthorPosition(article.authors, name),
            ...(doi !== undefined ? { doi } : {}),
          });
          return record;
        })
        .filter((a): a is PubMedArticle => a !== null);

      return Object.freeze({ clinicianId, npi, query, articles, totalCount, fetchedAt });
    } catch (error) {
      log('error', 'pubmed_adapter_error', {
        clinicianId,
        error: error instanceof Error ? error.message : String(error),
      });

      return Object.freeze({ clinicianId, npi, query, articles: [], totalCount: 0, fetchedAt });
    }
  }
}
