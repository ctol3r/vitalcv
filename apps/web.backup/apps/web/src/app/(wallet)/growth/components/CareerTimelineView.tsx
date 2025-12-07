/**
 * Phase 5: Career Timeline & Inspiration Layer (8 tasks)
 * Task 33: Add CareerTimelineView
 */

'use client';

import { motion } from 'framer-motion';
import {
  GraduationCap,
  Briefcase,
  Award,
  MapPin,
  Sparkles,
  TrendingUp,
  Target,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CareerMilestone, TrustScoreEvolution } from '@/lib/growth/models';

interface CareerTimelineViewProps {
  milestones: CareerMilestone[];
  trustHistory: TrustScoreEvolution[];
  currentTrustScore: number;
}

export function CareerTimelineView({
  milestones,
  trustHistory,
  currentTrustScore,
}: CareerTimelineViewProps) {
  // Sort milestones chronologically
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const getMilestoneIcon = (type: CareerMilestone['type']) => {
    switch (type) {
      case 'education':
        return GraduationCap;
      case 'residency':
        return Briefcase;
      case 'certification':
        return Award;
      case 'role':
        return Briefcase;
      case 'achievement':
        return Target;
      default:
        return Award;
    }
  };

  const getMilestoneColor = (type: CareerMilestone['type']) => {
    switch (type) {
      case 'education':
        return 'bg-blue-500';
      case 'residency':
        return 'bg-purple-500';
      case 'certification':
        return 'bg-emerald-500';
      case 'role':
        return 'bg-amber-500';
      case 'achievement':
        return 'bg-indigo-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Create timeline with trust score evolution
  const timelineEvents = sorted.map((milestone) => {
    const trustAtTime = trustHistory.find(
      (h) => new Date(h.date).getTime() <= new Date(milestone.date).getTime(),
    );
    return {
      ...milestone,
      trustScore: trustAtTime?.score || 0,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Career Timeline</h2>
        <p className="text-muted-foreground">
          Your professional journey with milestones and achievements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Professional Journey
          </CardTitle>
          <CardDescription>
            {sorted.length} milestone{sorted.length !== 1 ? 's' : ''} tracked
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline events */}
            <div className="space-y-8">
              {timelineEvents.map((event, idx) => {
                const Icon = getMilestoneIcon(event.type);
                const color = getMilestoneColor(event.type);
                const isLast = idx === timelineEvents.length - 1;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative flex gap-4"
                  >
                    {/* Milestone dot */}
                    <div className="relative z-10">
                      <motion.div
                        className={`w-16 h-16 rounded-full ${color} flex items-center justify-center text-white shadow-lg`}
                        whileHover={{ scale: 1.1 }}
                        animate={{
                          scale: [1, 1.05, 1],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 3,
                        }}
                      >
                        <Icon className="h-8 w-8" />
                      </motion.div>
                      {/* Trust pulse indicator */}
                      {event.trustPulse && event.trustPulse > 0 && (
                        <motion.div
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <Sparkles className="h-3 w-3 text-white" />
                        </motion.div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <Card className="border-2 hover:border-primary transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg">{event.title}</h3>
                                <Badge variant="outline">{event.type}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {event.description}
                              </p>
                              {event.specialty && (
                                <Badge variant="secondary" className="mr-2">
                                  {event.specialty}
                                </Badge>
                              )}
                              {event.organization && (
                                <Badge variant="outline">{event.organization}</Badge>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {new Date(event.date).toLocaleDateString()}
                              </p>
                              {event.trustPulse && event.trustPulse > 0 && (
                                <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                                  <TrendingUp className="h-3 w-3" />
                                  +{(event.trustPulse * 100).toFixed(0)}% trust
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </motion.div>
                );
              })}

              {/* Current position */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: timelineEvents.length * 0.1 }}
                className="relative flex gap-4"
              >
                <div className="relative z-10">
                  <motion.div
                    className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Target className="h-8 w-8" />
                  </motion.div>
                </div>
                <div className="flex-1">
                  <Card className="border-2 border-primary bg-primary/5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">Current Position</h3>
                          <p className="text-sm text-muted-foreground">
                            Trust Score: {(currentTrustScore * 100).toFixed(1)}%
                          </p>
                        </div>
                        <Badge variant="default">Now</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Path Prediction Overlay */}
      {timelineEvents.length > 0 && (
        <Card className="border-2 border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Suggested Next Steps
            </CardTitle>
            <CardDescription>
              Based on your career trajectory, here are recommended paths
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg border-teal-200 bg-teal-50 dark:bg-teal-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-teal-500" />
                  <span className="font-semibold">Certification Path</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pursue additional certifications to expand your expertise
                </p>
              </div>
              <div className="p-4 border rounded-lg border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-semibold">New Role Path</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Explore leadership or specialized roles in your field
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

