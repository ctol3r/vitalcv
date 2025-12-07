import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

/**
 * Generate embedding vector for text using OpenAI
 * @param text Text to embed (will be truncated to 8000 chars)
 * @returns Embedding vector (1536 dimensions for text-embedding-3-large)
 */
export async function embed(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.EMBED_MODEL || "text-embedding-3-large";

  const res = await openai.embeddings.create({
    model,
    input: text.slice(0, 8000),
  });

  return res.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.EMBED_MODEL || "text-embedding-3-large";

  const res = await openai.embeddings.create({
    model,
    input: texts.map(t => t.slice(0, 8000)),
  });

  return res.data.map(d => d.embedding);
}

