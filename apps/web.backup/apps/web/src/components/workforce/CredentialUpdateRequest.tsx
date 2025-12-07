/**
 * Credential Update Request Component
 * Phase 5: Task 36 - Credential Update Request at the unit level
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Send } from 'lucide-react';
import { useState } from 'react';

interface Unit {
  id: string;
  name: string;
  type: string;
  staleCredentials: number;
}

export function CredentialUpdateRequest() {
  const [sending, setSending] = useState(false);

  const units: Unit[] = [
    { id: 'unit-1', name: 'ICU - Main', type: 'ICU', staleCredentials: 5 },
    { id: 'unit-2', name: 'ED - Main', type: 'ED', staleCredentials: 3 },
  ];

  const handleSendRequest = async (unit: Unit) => {
    setSending(true);
    // TODO: Implement credential update request
    setTimeout(() => {
      setSending(false);
      alert(`Credential update request sent to ${unit.name}`);
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Units with Stale Credentials</h4>
      </div>
      <div className="space-y-2">
        {units.map((unit) => (
          <div key={unit.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{unit.name}</span>
                <Badge variant="secondary">{unit.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {unit.staleCredentials} stale credential(s) detected
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSendRequest(unit)}
              disabled={sending}
              className="gap-2"
            >
              <Send className="h-3 w-3" />
              Send Request
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}








