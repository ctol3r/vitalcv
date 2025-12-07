'use client';

/**
 * New Conversation Page
 * Start a new conversation with a clinician
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, User, AlertCircle, Loader2 } from 'lucide-react';
import { initiateConversation } from '@/lib/api/messages';

// Mock user ID - in production, get from auth context
const MOCK_RECRUITER_ID = 'recruiter-1';
const MOCK_RECRUITER_DID = 'did:vital:recruiter-1';

export default function NewConversationPage() {
  const router = useRouter();
  const [clinicianId, setClinicianId] = useState('');
  const [clinicianDid, setClinicianDid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartConversation() {
    if (!clinicianId.trim()) {
      setError('Clinician ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { conversationId } = await initiateConversation(
        MOCK_RECRUITER_ID,
        clinicianId.trim(),
        MOCK_RECRUITER_DID,
        clinicianDid.trim() || undefined
      );

      router.push(`/recruiter/messages/${conversationId}`);
    } catch (err) {
      console.error('[Messages] Failed to start conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 py-8">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Conversation</h1>
          <p className="text-muted-foreground mt-1">
            Start a secure conversation with a clinician
          </p>
        </div>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Clinician Information
          </CardTitle>
          <CardDescription>
            Enter the clinician ID or DID to start a conversation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicianId">Clinician ID *</Label>
            <Input
              id="clinicianId"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="clinician-123"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              The unique identifier for the clinician
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinicianDid">Clinician DID (Optional)</Label>
            <Input
              id="clinicianDid"
              value={clinicianDid}
              onChange={(e) => setClinicianDid(e.target.value)}
              placeholder="did:vital:clinician-123"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Decentralized identifier for enhanced security
            </p>
          </div>

          <Button
            onClick={handleStartConversation}
            disabled={!clinicianId.trim() || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting conversation...
              </>
            ) : (
              'Start Conversation'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

