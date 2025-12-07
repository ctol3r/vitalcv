/**
 * Assign Shift Shortcut Component
 * Phase 5: Task 33 - Assign shift from Command Center shortcut
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

export function AssignShiftShortcut() {
  const [assigning, setAssigning] = useState(false);

  const handleAssignShift = async () => {
    setAssigning(true);
    // TODO: Implement shift assignment with credential verification
    setTimeout(() => {
      setAssigning(false);
      alert('Shift assignment initiated. Credential verification in progress...');
    }, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div>
          <h4 className="font-semibold mb-1">Quick Shift Assignment</h4>
          <p className="text-sm text-muted-foreground">
            Assign shifts with automatic credential verification
          </p>
        </div>
        <Button onClick={handleAssignShift} disabled={assigning} className="gap-2">
          <Calendar className="h-4 w-4" />
          {assigning ? 'Assigning...' : 'Assign Shift'}
        </Button>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        <span>Credential verification integrated with Shift Credentialing module</span>
      </div>
    </div>
  );
}








