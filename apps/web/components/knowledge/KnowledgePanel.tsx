'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck2,
  Building2,
  User,
  Briefcase,
  Scale,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  generateLinks,
  getLinksByType,
  ENTITY_COLORS,
  ENTITY_LABELS,
  type EntityType,
  type EntityLink,
} from '@/lib/links';
import { Block } from '@/components/ui/Block';

const TYPE_ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  credential: FileCheck2,
  issuer: Building2,
  clinician: User,
  employer: Briefcase,
  decision: Scale,
};

const SECTIONS: EntityType[] = ['credential', 'issuer', 'decision', 'employer'];

interface KnowledgePanelProps {
  entityId: string;
  className?: string;
  onClose?: () => void;
}

/**
 * Wave 67 — Knowledge Panel
 * Displays bidirectional relationships for a given entity.
 * Links are clickable nodes grouped by type.
 */
export function KnowledgePanel({ entityId, className, onClose }: KnowledgePanelProps) {
  const allLinks = generateLinks(entityId);

  if (allLinks.length === 0) {
    return null;
  }

  return (
    <motion.div
      className={cn('w-full max-w-sm', className)}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Block className="relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-1.5 text-[var(--ag-text-subtle)] transition-colors hover:bg-[var(--ag-bg-alt)] hover:text-[var(--ag-text)]"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--ag-accent)]">
            Knowledge Panel
          </p>
          <h3 className="mt-1 font-heading text-lg font-semibold text-[var(--ag-text)]">
            Related Entities
          </h3>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((type) => {
            const links = getLinksByType(entityId, type);
            if (links.length === 0) return null;

            const Icon = TYPE_ICONS[type];

            return (
              <LinkSection
                key={type}
                type={type}
                label={ENTITY_LABELS[type]}
                icon={<Icon className="h-4 w-4" />}
                links={links}
              />
            );
          })}
        </div>
      </Block>
    </motion.div>
  );
}

function LinkSection({
  type,
  label,
  icon,
  links,
}: {
  type: EntityType;
  label: string;
  icon: React.ReactNode;
  links: EntityLink[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-semibold', ENTITY_COLORS[type])}>
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--ag-text-muted)]">
          Related {label}s
        </span>
      </div>

      <div className="space-y-1.5">
        {links.map((link) => (
          <LinkNode key={link.id} link={link} />
        ))}
      </div>
    </div>
  );
}

function LinkNode({ link }: { link: EntityLink }) {
  return (
    <Link
      href={link.href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5',
        'border border-transparent bg-[var(--ag-bg-alt)]/50',
        'transition-all duration-200',
        'hover:border-[var(--ag-glass-border)] hover:bg-[var(--ag-glass)] hover:shadow-[var(--ag-shadow-sm)]',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-[var(--ag-text)]">
          {link.label}
        </p>
        {link.description && (
          <p className="truncate text-xs text-[var(--ag-text-subtle)]">
            {link.description}
          </p>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--ag-text-subtle)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--ag-primary)]" />
    </Link>
  );
}
