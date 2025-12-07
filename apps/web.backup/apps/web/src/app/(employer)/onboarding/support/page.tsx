'use client';

import { useState } from 'react';
import { Send, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function OnboardingSupportPage() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your onboarding support assistant. I can help you with ATS integration, auto-verification setup, role configuration, and more. What do you need help with?',
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { role: 'user', content: input }]);

    // Mock AI response
    setTimeout(() => {
      const responses: Record<string, string> = {
        ats: 'To connect your ATS, go to the Quick Connect section and select your ATS type (Greenhouse, Lever, or Workday). You can optionally provide an API key for automatic syncing.',
        verify: 'Auto-verification allows you to automatically verify all incoming applicants. Click "Setup Auto-Verify" in the onboarding dashboard to enable this feature.',
        roles: 'Role configuration helps you set up permissions for your team. Go to the Roles & Permissions step in onboarding to configure admin, reviewer, and auditor roles.',
      };

      const lowerInput = input.toLowerCase();
      let response = 'I can help you with ATS integration, auto-verification, role setup, and safety checks. Could you be more specific?';

      if (lowerInput.includes('ats') || lowerInput.includes('greenhouse') || lowerInput.includes('lever') || lowerInput.includes('workday')) {
        response = responses.ats;
      } else if (lowerInput.includes('verify') || lowerInput.includes('auto')) {
        response = responses.verify;
      } else if (lowerInput.includes('role') || lowerInput.includes('permission')) {
        response = responses.roles;
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    }, 500);

    setInput('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Onboarding Support AI</h1>
        <p className="text-muted-foreground mt-2">Chat assistant trained on VitalCV documentation</p>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Support Chat
          </CardTitle>
          <CardDescription>Ask questions about onboarding, setup, and configuration</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question about onboarding..."
            />
            <Button onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

