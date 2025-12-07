/**
 * Role-Based Floating Action Buttons (FAB)
 * Displays floating actions specific to the current role
 */

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Share,
  GraduationCap,
  Calendar,
  ClipboardCheck,
  FileText,
  DollarSign,
  Shield,
  CheckCircle,
  Users,
  UserCheck,
  Map,
  Key,
  MoreVertical,
  X,
} from 'lucide-react';
import { roleUIEngine, RoleType } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Icon mapping
const iconMap: Record<string, typeof ShieldCheck> = {
  'shield-check': ShieldCheck,
  'share': Share,
  'graduation-cap': GraduationCap,
  'calendar': Calendar,
  'clipboard-check': ClipboardCheck,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  'shield': Shield,
  'check-circle': CheckCircle,
  'users': Users,
  'user-check': UserCheck,
  'map': Map,
  'key': Key,
};

interface RoleFloatingActionsProps {
  roleType: RoleType | null;
  className?: string;
}

/**
 * RoleFloatingActions Component
 * Renders floating action buttons based on current role
 */
export function RoleFloatingActions({ roleType, className }: RoleFloatingActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = roleType ? roleUIEngine.getFloatingActions(roleType) : [];
  const theme = roleType ? roleUIEngine.getRoleTheme(roleType) : null;

  if (!roleType || actions.length === 0) {
    return null;
  }

  const handleAction = (actionId: string) => {
    // Handle action - this would dispatch to appropriate handler
    console.log('Action triggered:', actionId);
    setIsOpen(false);
  };

  return (
    <div className={cn('fixed bottom-6 right-6 z-50', className)}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4 flex flex-col gap-2"
          >
            {actions.map((action, index) => {
              const Icon = iconMap[action.icon] || MoreVertical;

              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleAction(action.action)}
                  className={cn(
                    'flex items-center gap-3 rounded-full px-4 py-3 shadow-lg',
                    'bg-background border text-foreground',
                    'hover:bg-accent transition-colors'
                  )}
                  style={{
                    borderColor: theme?.colors.primary,
                    backgroundColor: `${theme?.colors.primary}10`,
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: theme?.colors.primary }} />
                  <span className="text-sm font-medium">{action.label}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full shadow-lg',
          'transition-all hover:scale-110'
        )}
        style={{
          backgroundColor: theme?.colors.primary,
          color: '#ffffff',
        }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <X className="h-6 w-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <MoreVertical className="h-6 w-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

