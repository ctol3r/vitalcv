'use client';

/**
 * PrequalifyBar — Wave 182
 * Persistent bottom completion bar — shown when a user hasn't finished prequalification.
 * Inspired by Mercor's "resume / assessment" persistent prompt.
 * Feature-flagged behind FEATURE_PREQUALIFY_FLOW_V2.
 */

import { FEATURES } from '@/lib/features';
import { useRoleContext } from '@/components/auth/RoleContext';
import { X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface Step { label: string; done: boolean }

const DEFAULT_STEPS: Step[] = [
  { label: 'NPI Verified',       done: false },
  { label: 'Links Added',        done: false },
  { label: 'Work Auth',          done: false },
];

interface PrequalifyBarProps {
  steps?: Step[];
  /** If true, bar is hidden */
  dismissed?: boolean;
}

export default function PrequalifyBar({ steps = DEFAULT_STEPS, dismissed = false }: PrequalifyBarProps) {
  return null;
}
