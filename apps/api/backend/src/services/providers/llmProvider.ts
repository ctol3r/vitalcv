/**
 * Wave 196 — LLM Provider Interface
 *
 * Provides a swappable LLM abstraction.
 * Uses OpenAI if OPENAI_API_KEY is set, otherwise falls back to stub.
 */

export interface ILlmProvider {
  chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    opts?: { model?: string; maxTokens?: number },
  ): Promise<string>;
}

class StubLlmProvider implements ILlmProvider {
  async chat(
    messages: { role: string; content: string }[],
    _opts?: { model?: string },
  ): Promise<string> {
    const last = messages[messages.length - 1]?.content ?? '';
    return `[stub] Received: "${last.slice(0, 80)}${last.length > 80 ? '…' : ''}"`;
  }
}

class OpenAiLlmProvider implements ILlmProvider {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    opts?: { model?: string; maxTokens?: number },
  ): Promise<string> {
    const model = opts?.model ?? 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 1024,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? '';
  }
}

let _provider: ILlmProvider | null = null;

export function getLlmProvider(): ILlmProvider {
  if (_provider) return _provider;
  const key = process.env.OPENAI_API_KEY;
  _provider = key ? new OpenAiLlmProvider(key) : new StubLlmProvider();
  return _provider;
}

/** For testing: override the singleton provider. */
export function setLlmProvider(provider: ILlmProvider): void {
  _provider = provider;
}
