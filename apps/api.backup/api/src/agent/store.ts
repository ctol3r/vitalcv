import { embed } from "./embeddings";
import { pool } from "./db";
import { McpManifestT, McpTool } from "./types";
import { v4 as uuid } from "uuid";

const usePgVector = (process.env.MCP_VECTOR_BACKEND || "pgvector") === "pgvector";

/**
 * Upsert an MCP tool to the database with vector embedding
 */
export async function upsertMcp(
  manifest: McpManifestT,
  code?: string
): Promise<string> {
  const id = uuid();
  const textForEmbed = `${manifest.name}\n${manifest.description}\n${JSON.stringify(manifest.steps)}`;
  const vec = await embed(textForEmbed);

  const q = `
    INSERT INTO "McpTool"(id, name, description, scope, tags, code, manifest, embedding)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      scope = EXCLUDED.scope,
      tags = EXCLUDED.tags,
      code = EXCLUDED.code,
      manifest = EXCLUDED.manifest,
      embedding = EXCLUDED.embedding,
      updated_at = now()
    RETURNING id
  `;

  const result = await pool.query(q, [
    id,
    manifest.name,
    manifest.description,
    manifest.scope,
    manifest.tags,
    code || null,
    JSON.stringify(manifest),
    usePgVector ? `[${vec.join(",")}]` : null,
  ]);

  // If using Qdrant mode, upsert vector there with HNSW index (Round 10)
  if (!usePgVector) {
    const { QdrantClient } = await import("@qdrant/js-client-rest");
    const qc = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY || undefined,
    });

    await qc.upsert("mcp_tools", {
      points: [
        {
          id,
          vector: vec,
          payload: {
            id,
            name: manifest.name,
            scope: manifest.scope,
            tags: manifest.tags,
          },
        },
      ],
    });
  }

  return result.rows[0].id;
}

/**
 * Search for MCPs using semantic similarity
 */
export async function searchMcp(
  query: string,
  scopeHints: string[] = [],
  topK = 5
): Promise<McpTool[]> {
  const qvec = await embed(query);

  if (usePgVector) {
    const vectorString = `[${qvec.join(",")}]`;
    const scopeFilter = scopeHints.length > 0
      ? `AND scope = ANY($2::text[])`
      : '';

    const queryText = `
      SELECT
        id::text,
        name,
        description,
        scope,
        tags,
        manifest,
        code,
        reliability_score,
        usage_count,
        created_at,
        updated_at,
        1 - (embedding <=> $1::vector) AS score
      FROM "McpTool"
      WHERE 1=1 ${scopeFilter}
      ORDER BY embedding <=> $1::vector
      LIMIT $${scopeHints.length > 0 ? '3' : '2'}
    `;

    const params = scopeHints.length > 0
      ? [vectorString, scopeHints, topK]
      : [vectorString, topK];

    const res = await pool.query(queryText, params);

    return res.rows.map(row => ({
      ...row,
      manifest: typeof row.manifest === 'string'
        ? JSON.parse(row.manifest)
        : row.manifest,
    }));
  } else {
    // Qdrant mode
    const { QdrantClient } = await import("@qdrant/js-client-rest");
    const qc = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY || undefined,
    });

    // Round 10: Add scope filter when using Qdrant (HNSW + prefilter)
    const searchParams: any = {
      vector: qvec,
      limit: topK,
    };

    if (scopeHints.length > 0) {
      searchParams.filter = {
        must: [{ key: 'scope', match: { any: scopeHints } }]
      };
    }

    const res = await qc.search("mcp_tools", searchParams);

    // Fetch full records from Postgres
    const ids = res.map((r: any) => r.payload.id);
    const dbRes = await pool.query(
      `SELECT * FROM "McpTool" WHERE id = ANY($1)`,
      [ids]
    );

    return dbRes.rows.map(row => ({
      ...row,
      manifest: typeof row.manifest === 'string'
        ? JSON.parse(row.manifest)
        : row.manifest,
      score: res.find((r: any) => r.payload.id === row.id)?.score || 0,
    }));
  }
}

/**
 * Update MCP usage statistics
 */
export async function incrementMcpUsage(id: string, success: boolean) {
  const reliabilityDelta = success ? 0.01 : -0.02;

  await pool.query(
    `
    UPDATE "McpTool"
    SET
      usage_count = usage_count + 1,
      reliability_score = LEAST(1.0, GREATEST(0.0, reliability_score + $2)),
      updated_at = now()
    WHERE id = $1
    `,
    [id, reliabilityDelta]
  );
}

/**
 * Get MCP by ID
 */
export async function getMcpById(id: string): Promise<McpTool | null> {
  const res = await pool.query(
    `SELECT * FROM "McpTool" WHERE id = $1`,
    [id]
  );

  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    ...row,
    manifest: typeof row.manifest === 'string'
      ? JSON.parse(row.manifest)
      : row.manifest,
  };
}

