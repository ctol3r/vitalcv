-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- McpTool: Stores reusable agent workflows/tools with vector embeddings
CREATE TABLE IF NOT EXISTS "McpTool" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  scope TEXT NOT NULL,       -- 'global' | 'domain:<slug>' | 'user:<id>'
  tags TEXT[] DEFAULT '{}',
  code TEXT,                 -- optional: code/workflow body
  manifest JSONB,            -- normalized MCP schema (inputs/outputs/steps)
  reliability_score FLOAT DEFAULT 0,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  embedding VECTOR(1536)     -- match PGVECTOR_DIM
);

-- Index for vector similarity search using IVFFlat
CREATE INDEX IF NOT EXISTS mcptool_embedding_idx
  ON "McpTool"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Additional indexes for querying
CREATE INDEX IF NOT EXISTS mcptool_scope_idx ON "McpTool"(scope);
CREATE INDEX IF NOT EXISTS mcptool_name_idx ON "McpTool"(name);

-- AgentTrace: Stores execution traces for learning and debugging
CREATE TABLE IF NOT EXISTS "AgentTrace" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type TEXT NOT NULL,   -- 'parse', 'verify', 'match', etc.
  user_id TEXT,
  domain TEXT,               -- e.g. 'physician', 'nursing'
  input JSONB,
  steps JSONB,               -- sequence of tool calls / plan
  outcome JSONB,             -- { success: bool, notes, metrics }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for trace analysis
CREATE INDEX IF NOT EXISTS agenttrace_task_type_idx ON "AgentTrace"(task_type);
CREATE INDEX IF NOT EXISTS agenttrace_created_at_idx ON "AgentTrace"(created_at DESC);
CREATE INDEX IF NOT EXISTS agenttrace_user_id_idx ON "AgentTrace"(user_id);
CREATE INDEX IF NOT EXISTS agenttrace_domain_idx ON "AgentTrace"(domain);

