/**
 * RoleSwitch Component
 * Animated role switching UI with orb morphs and role-specific theming
 */

'use client';

import {
  Stethoscope,
  HeartPulse,
  GraduationCap,
  Flask,
  Briefcase,
  Users,
  Video,
  Building2,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { RoleType, roleEngine, useRoleSwitch, useRoleProfile } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';

// Icon mapping for roles
const roleIcons: Record<RoleType, typeof Stethoscope> = {
  [RoleType.CLINICIAN]: Stethoscope,
  [RoleType.NURSE]: HeartPulse,
  [RoleType.FACULTY]: GraduationCap,
  [RoleType.RESEARCHER]: Flask,
  [RoleType.ADMINISTRATOR]: Briefcase,
  [RoleType.PRECEPTOR]: Users,
  [RoleType.TELEMEDICINE]: Video,
  [RoleType.MULTI_FACILITY]: Building2,
};

interface RoleSwitchProps {
  did: string | null;
  className?: string;
  variant?: 'compact' | 'full';
}

/**
 * RoleSwitch Component
 * Displays current role and allows switching between available roles
 */
export function RoleSwitch({ did, className, variant = 'full' }: RoleSwitchProps) {
  const { currentRole, availableRoles, switchRole, isLoading, error } = useRoleSwitch(did);
  const [isOpen, setIsOpen] = useState(false);

  const handleSwitch = useCallback(
    async (roleType: RoleType) => {
      const success = await switchRole(roleType);
      if (success) {
        setIsOpen(false);
      }
    },
    [switchRole]
  );

  if (!did || availableRoles.length === 0) {
    return null;
  }

  const currentMetadata = currentRole ? roleEngine.getRoleMetadata(currentRole) : null;
  const CurrentIcon = currentRole ? roleIcons[currentRole] : Stethoscope;

  if (variant === 'compact') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn('relative', className)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CurrentIcon className="h-4 w-4" />
                {currentMetadata && (
                  <span className="ml-2 text-xs">{currentMetadata.displayName}</span>
                )}
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <RoleList
            availableRoles={availableRoles}
            currentRole={currentRole}
            onSwitch={handleSwitch}
            isLoading={isLoading}
            error={error}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'relative h-12 w-12 overflow-hidden rounded-full p-0 transition-all',
              currentMetadata && `border-2`,
              className
            )}
            style={
              currentMetadata
                ? {
                    borderColor: currentMetadata.color.primary,
                    backgroundColor: `${currentMetadata.color.primary}15`,
                  }
                : undefined
            }
            disabled={isLoading}
          >
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Loader2 className="h-6 w-6 animate-spin" />
                </motion.div>
              ) : currentRole && currentMetadata ? (
                <motion.div
                  key={currentRole}
                  initial={{ opacity: 0, scale: 0.8, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: 180 }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 25,
                  }}
                  className="flex h-full w-full items-center justify-center"
                >
                  <CurrentIcon
                    className="h-6 w-6"
                    style={{ color: currentMetadata.color.primary }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <RoleList
            availableRoles={availableRoles}
            currentRole={currentRole}
            onSwitch={handleSwitch}
            isLoading={isLoading}
            error={error}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface RoleListProps {
  availableRoles: Array<{
    roleType: RoleType;
    trustScore: number;
    compliance: { complianceScore: number; alerts: Array<{ severity: string }> };
    isActive: boolean;
  }>;
  currentRole: RoleType | null;
  onSwitch: (roleType: RoleType) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

function RoleList({
  availableRoles,
  currentRole,
  onSwitch,
  isLoading,
  error,
}: RoleListProps) {
  return (
    <div className="flex flex-col">
      <div className="border-b p-4">
        <h3 className="font-semibold">Switch Role</h3>
        <p className="text-sm text-muted-foreground">
          Select a professional role to view role-specific credentials and features
        </p>
      </div>

      {error && (
        <div className="border-b bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto p-2">
        {availableRoles.map((role) => {
          const metadata = roleEngine.getRoleMetadata(role.roleType);
          const Icon = roleIcons[role.roleType];
          const isCurrent = role.roleType === currentRole;
          const { canActivate, blockers } = roleEngine.canActivateRole('', role.roleType);

          return (
            <motion.button
              key={role.roleType}
              onClick={() => !isLoading && onSwitch(role.roleType)}
              disabled={isLoading || isCurrent || !canActivate}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-lg p-3 text-left transition-all',
                'hover:bg-accent',
                isCurrent && 'bg-accent',
                (!canActivate || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Animated orb icon */}
              <motion.div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isCurrent && 'ring-2 ring-offset-2'
                )}
                style={{
                  backgroundColor: `${metadata.color.primary}20`,
                  borderColor: metadata.color.primary,
                }}
                animate={{
                  scale: isCurrent ? [1, 1.1, 1] : 1,
                }}
                transition={{
                  duration: 2,
                  repeat: isCurrent ? Infinity : 0,
                  ease: 'easeInOut',
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: metadata.color.primary }}
                />
              </motion.div>

              {/* Role info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{metadata.displayName}</span>
                  {isCurrent && (
                    <Badge variant="default" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metadata.description}
                </p>

                {/* Trust and compliance scores */}
                <div className="mt-2 flex gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Trust</span>
                      <span className="font-medium">
                        {(role.trustScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={role.trustScore * 100}
                      className="h-1 mt-1"
                      style={{
                        backgroundColor: `${metadata.color.primary}20`,
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Compliance</span>
                      <span className="font-medium">
                        {(role.compliance.complianceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      value={role.compliance.complianceScore * 100}
                      className="h-1 mt-1"
                    />
                  </div>
                </div>

                {/* Blockers */}
                {blockers.length > 0 && !isCurrent && (
                  <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    {blockers[0]}
                  </div>
                )}
              </div>

              {/* Checkmark for current role */}
              {isCurrent && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="h-4 w-4" />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

