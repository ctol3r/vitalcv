/**
 * Facility Privileging Engine - AI Assistant Component
 * Phase 5 Task 39: AI assistant UI for "How to earn this privilege"
 */

'use client';

import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import {
  PrivilegeAIAssistant,
  type PrivilegePathwayGuidance,
  type PathwayStep,
} from '@/lib/privileging/PrivilegeAIAssistant';
import type { Privilege, ClinicianProfile } from '@/lib/privileging/models';

interface PrivilegePathwayAssistantProps {
  privilege: Privilege;
  profile: ClinicianProfile;
}

export function PrivilegePathwayAssistant({
  privilege,
  profile,
}: PrivilegePathwayAssistantProps) {
  const [guidance, setGuidance] = useState<PrivilegePathwayGuidance | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const assistant = new PrivilegeAIAssistant();

  function generateGuidance() {
    setLoading(true);
    try {
      const result = assistant.generatePathwayGuidance(privilege, profile);
      setGuidance(result);
      // Expand first step by default
      if (result.steps.length > 0) {
        setExpandedSteps(new Set([1]));
      }
    } catch (error) {
      console.error('Failed to generate guidance:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleStep(stepNumber: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  }

  const getStepIcon = (type: PathwayStep['type']) => {
    switch (type) {
      case 'credential':
        return <FileText className="h-4 w-4" />;
      case 'skill':
        return <GraduationCap className="h-4 w-4" />;
      case 'attestation':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'training':
        return <BookOpen className="h-4 w-4" />;
      case 'experience':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getDifficultyColor = (difficulty: PrivilegePathwayGuidance['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600';
      case 'medium':
        return 'text-amber-600';
      case 'hard':
        return 'text-orange-600';
      case 'very_hard':
        return 'text-red-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          How to Earn This Privilege
        </CardTitle>
        <CardDescription>
          AI-powered pathway guidance for {privilege.procedureName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!guidance ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Get personalized guidance on the steps needed to earn this privilege.
            </p>
            <Button onClick={generateGuidance} disabled={loading} className="w-full">
              {loading ? 'Generating Guidance...' : 'Generate Pathway Guidance'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Estimated Time</span>
                <Badge variant="outline">{guidance.estimatedTime}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Difficulty</span>
                <Badge
                  variant="outline"
                  className={getDifficultyColor(guidance.difficulty)}
                >
                  {guidance.difficulty.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Priority</span>
                <Badge variant="outline">{guidance.priority.toUpperCase()}</Badge>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Current Status</span>
                  <Badge
                    variant={
                      guidance.currentStatus.status === 'Eligible'
                        ? 'default'
                        : guidance.currentStatus.status === 'Conditional'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {guidance.currentStatus.status}
                  </Badge>
                </div>
                <Progress value={guidance.currentStatus.confidenceScore} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Confidence: {guidance.currentStatus.confidenceScore}%
                </p>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Pathway Steps</p>
              {guidance.steps.map((step) => (
                <Collapsible
                  key={step.stepNumber}
                  open={expandedSteps.has(step.stepNumber)}
                  onOpenChange={() => toggleStep(step.stepNumber)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40 cursor-pointer">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-sm font-semibold">{step.stepNumber}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{step.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStepIcon(step.type)}
                            <span className="text-xs text-muted-foreground">
                              {step.type} · {step.estimatedTime}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-lg border-t bg-muted/20 p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.resources && step.resources.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2">Resources:</p>
                          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                            {step.resources.map((resource, idx) => (
                              <li key={idx}>{resource}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {step.prerequisites && step.prerequisites.length > 0 && (
                        <div>
                          <p className="text-xs font-medium mb-2">Prerequisites:</p>
                          <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                            {step.prerequisites.map((prereq, idx) => (
                              <li key={idx}>{prereq}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => setGuidance(null)}
              className="w-full"
            >
              Generate New Guidance
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

