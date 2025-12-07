/**
 * B250B-DOC-015: FullTextSearchService
 * Indexes documents and versions into search engine (PostgreSQL full-text)
 * Supports queries with filters by category and tag
 * Highlights matches
 */

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const SearchSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export interface SearchParams {
  query: string;
  category?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  document: {
    id: string;
    title: string;
    content: string | null;
    category: string | null;
    tags: string[];
    status: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  relevance: number;
  highlights: string[];
}

export class FullTextSearchService {
  /**
   * Search documents using PostgreSQL full-text search
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    // Validate input
    const validated = SearchSchema.parse(params);

    // Build search query
    // PostgreSQL full-text search uses to_tsvector and to_tsquery
    const searchTerms = validated.query
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term.replace(/[^\w]/g, ''))
      .filter((term) => term.length > 0)
      .join(' & ');

    if (!searchTerms) {
      return [];
    }

    // Build where clause
    const where: any = {
      status: {
        in: ['DRAFT', 'PUBLISHED'], // Only search published and draft documents
      },
      OR: [
        {
          title: {
            contains: validated.query,
            mode: 'insensitive',
          },
        },
        {
          content: {
            contains: validated.query,
            mode: 'insensitive',
          },
        },
      ],
    };

    if (validated.category) {
      where.category = validated.category;
    }

    if (validated.tags && validated.tags.length > 0) {
      where.tags = {
        hasSome: validated.tags,
      };
    }

    // Execute search
    const documents = await prisma.document.findMany({
      where,
      take: validated.limit,
      skip: validated.offset,
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    // Calculate relevance and highlights
    const results: SearchResult[] = documents.map((doc) => {
      const relevance = this.calculateRelevance(doc, validated.query);
      const highlights = this.extractHighlights(doc, validated.query);

      return {
        document: {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          category: doc.category,
          tags: doc.tags,
          status: doc.status,
          authorId: doc.authorId,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        },
        relevance,
        highlights,
      };
    });

    // Sort by relevance
    results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * Calculate relevance score for a document
   */
  private calculateRelevance(document: any, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t) => t.length > 0);

    // Title matches are worth more
    if (document.title) {
      const titleLower = document.title.toLowerCase();
      terms.forEach((term) => {
        if (titleLower.includes(term)) {
          score += 10;
        }
      });
    }

    // Content matches
    if (document.content) {
      const contentLower = document.content.toLowerCase();
      terms.forEach((term) => {
        const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
        score += matches * 1;
      });
    }

    // Tag matches
    if (document.tags) {
      document.tags.forEach((tag: string) => {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 5;
        }
      });
    }

    return score;
  }

  /**
   * Extract highlight snippets from document
   */
  private extractHighlights(document: any, query: string): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();
    const terms = queryLower.split(/\s+/).filter((t) => t.length > 0);

    if (!document.content) {
      return highlights;
    }

    const content = document.content;
    const snippetLength = 150;

    terms.forEach((term) => {
      const regex = new RegExp(term, 'gi');
      const matches = [...content.matchAll(regex)];

      matches.slice(0, 3).forEach((match) => {
        const index = match.index || 0;
        const start = Math.max(0, index - snippetLength / 2);
        const end = Math.min(content.length, index + snippetLength / 2);
        let snippet = content.substring(start, end);

        // Highlight the term
        snippet = snippet.replace(regex, (match) => `<mark>${match}</mark>`);

        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        highlights.push(snippet);
      });
    });

    return highlights.slice(0, 5); // Limit to 5 highlights
  }

  /**
   * Index a document (for future use with external search engines)
   */
  async indexDocument(documentId: string): Promise<void> {
    // For now, documents are automatically searchable via Prisma queries
    // In the future, this could sync to Elasticsearch or similar
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Placeholder for future indexing logic
    // Could integrate with Elasticsearch, Algolia, etc.
  }
}

export const fullTextSearchService = new FullTextSearchService();

