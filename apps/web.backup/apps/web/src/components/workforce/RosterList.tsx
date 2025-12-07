/**
 * Roster List Component
 * Phase 3: Task 18 - Roster list with name, role, trustScore, eligibilityScore, credential health
 */

'use client';

import { Badge } from '@/components/ui/badge';
import type { ClinicianRoster } from '@/lib/workforce/models';
import { ShieldCheck, AlertCircle, Clock } from 'lucide-react';

interface RosterListProps {
  roster: ClinicianRoster[];
}

const credentialHealthColors = {
  excellent: 'bg-green-100 text-green-800 border-green-300',
  good: 'bg-blue-100 text-blue-800 border-blue-300',
  fair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  poor: 'bg-red-100 text-red-800 border-red-300',
};

export function RosterList({ roster }: RosterListProps) {
  return (
    <div className="space-y-2">
      {roster.map((clinician) => (
        <div
          key={clinician.id}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">{clinician.name}</span>
              <Badge variant="outline">{clinician.role}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Trust: {clinician.trustScore.toFixed(2)}</span>
              <span>Eligibility: {clinician.eligibilityScore.toFixed(2)}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last verified: {new Date(clinician.lastVerified).toLocaleDateString()}
              </span>
            </div>
            {clinician.specialties.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {clinician.specialties.map((specialty) => (
                  <Badge key={specialty} variant="secondary" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={credentialHealthColors[clinician.credentialHealth]}
            >
              {clinician.credentialHealth === 'excellent' && <ShieldCheck className="h-3 w-3 mr-1" />}
              {clinician.credentialHealth === 'poor' && <AlertCircle className="h-3 w-3 mr-1" />}
              {clinician.credentialHealth.charAt(0).toUpperCase() + clinician.credentialHealth.slice(1)}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}








