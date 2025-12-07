/**
 * Task 10: Career Stage Banner with Animation
 */

'use client';

import { motion } from 'framer-motion';
import { GraduationCap, Briefcase, Award, Users, Crown, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CareerStage } from '@/lib/growth/models';

interface CareerStageBannerProps {
  stage: CareerStage;
  label: string;
  color: string;
}

const stageIcons: Record<CareerStage, typeof GraduationCap> = {
  student: GraduationCap,
  resident: Briefcase,
  early_career: Award,
  mid_career: Users,
  senior: Crown,
};

const stageColors: Record<CareerStage, string> = {
  student: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
  resident: 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400',
  early_career: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400',
  mid_career: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
  senior: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-400',
};

export function CareerStageBanner({ stage, label, color }: CareerStageBannerProps) {
  const Icon = stageIcons[stage];
  const bgColor = stageColors[stage];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`${bgColor} border-2`}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Icon className="h-12 w-12" />
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl font-bold">Career Stage</h2>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {getStageDescription(stage)}
              </p>
            </div>
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function getStageDescription(stage: CareerStage): string {
  const descriptions: Record<CareerStage, string> = {
    student: 'Building foundational knowledge and preparing for clinical practice',
    resident: 'Gaining hands-on experience under supervision',
    early_career: 'Establishing expertise and building professional reputation',
    mid_career: 'Leading teams and advancing specialty knowledge',
    senior: 'Mentoring next generation and shaping healthcare delivery',
  };
  return descriptions[stage];
}

