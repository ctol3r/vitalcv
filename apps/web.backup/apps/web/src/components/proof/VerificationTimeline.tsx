'use client';

import { CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimelineStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp?: string;
}

interface VerificationTimelineProps {
  steps: TimelineStep[];
}

export function VerificationTimeline({ steps }: VerificationTimelineProps) {
  const getStepIcon = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <div className="mt-0.5">{getStepIcon(step.status)}</div>
              <div className="flex-1">
                <div className="font-medium">{step.step}</div>
                {step.timestamp && (
                  <div className="text-sm text-muted-foreground">
                    {new Date(step.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}








