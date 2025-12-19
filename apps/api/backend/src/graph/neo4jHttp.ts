type Neo4jResultRow = Record<string, unknown>;

export type Neo4jRunResult = {
  columns: string[];
  data: Array<{ row: Neo4jResultRow }>;
};

function baseUrl(): string {
  return String(process.env.NEO4J_HTTP_URL || '').trim().replace(/\/+$/, '');
}

function database(): string {
  return String(process.env.NEO4J_DATABASE || 'neo4j').trim() || 'neo4j';
}

function authHeader(): string | null {
  const user = String(process.env.NEO4J_USER || '').trim();
  const pass = String(process.env.NEO4J_PASSWORD || '').trim();
  if (!user || !pass) return null;
  const token = Buffer.from(`${user}:${pass}`).toString('base64');
  return `Basic ${token}`;
}

export function neo4jConfigured(): boolean {
  return Boolean(baseUrl() && authHeader());
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...init, signal: controller.signal });
    const json = await resp.json().catch(() => ({ error: 'Invalid JSON from Neo4j', status: resp.status }));
    return { ok: resp.ok, status: resp.status, json };
  } finally {
    clearTimeout(id);
  }
}

export async function neo4jRunCypher(
  statement: string,
  parameters: Record<string, unknown> = {},
  timeoutMs = Number(process.env.NEO4J_TIMEOUT_MS || 2000),
): Promise<Neo4jRunResult> {
  const url = baseUrl();
  const auth = authHeader();
  if (!url || !auth) {
    throw new Error('Neo4j is not configured (NEO4J_HTTP_URL/NEO4J_USER/NEO4J_PASSWORD)');
  }

  // Neo4j transactional HTTP endpoint
  const txUrl = `${url}/db/${encodeURIComponent(database())}/tx/commit`;
  const body = {
    statements: [{ statement, parameters }],
  };

  const resp = await fetchJsonWithTimeout(
    txUrl,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: auth,
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!resp.ok) {
    throw new Error(`Neo4j HTTP ${resp.status}: ${JSON.stringify(resp.json)}`);
  }

  const first = resp.json?.results?.[0];
  return {
    columns: Array.isArray(first?.columns) ? first.columns : [],
    data: Array.isArray(first?.data) ? first.data : [],
  };
}


