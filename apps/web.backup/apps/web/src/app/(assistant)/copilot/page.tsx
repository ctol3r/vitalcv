'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, HelpCircle, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

export default function CopilotPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<any>(null);

  const askQuestion = useCallback(async () => {
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/copilot/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) {
        throw new Error(`Copilot API failed (${response.status})`);
      }
      const payload = await response.json();
      setAnswer(payload);
    } catch (err) {
      console.error('[assistant][copilot] ask failed', err);
      setError(formatError('copilot_failed', err instanceof Error ? err.message : 'Unable to get answer'));
    } finally {
      setLoading(false);
    }
  }, [question, formatError]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Credential Verification Copilot v4
          </CardTitle>
          <CardDescription>
            An AI assistant that walks issuers, verifiers & clinicians through every verification step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask a compliance question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void askQuestion();
                  }
                }}
              />
              <Button onClick={askQuestion} disabled={loading || !question.trim()}>
                Ask
              </Button>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            {answer && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Answer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>{answer.answer}</div>
                    {answer.sources && answer.sources.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        <div className="font-semibold mb-1">Sources:</div>
                        <ul className="list-disc list-inside">
                          {answer.sources.map((source: string, idx: number) => (
                            <li key={idx}>{source}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

