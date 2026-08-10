import * as React from 'react';
import Link from 'next/link';

/**
 * VitalGhostAction — the quiet secondary action (D-02).
 *
 * Hairline border, secondary text lifting to primary on hover; full pill.
 * Never filled, never green, never the focus of a composition — it exists so
 * "Check another NPI" and its siblings stop re-deriving this treatment per
 * island. String label for the same nested-interactive reason as VitalAction.
 */
export type VitalGhostActionProps = {
  label: string;
  register?: 'scene' | 'paper';
  size?: 'md' | 'lg';
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
  'data-testid'?: string;
};

const SIZE: Record<'md' | 'lg', string> = {
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-12 px-[20px] text-[14px]',
};

const REGISTER: Record<'scene' | 'paper', string> = {
  scene:
    'border-[var(--vt-scene-line-strong)] text-[var(--vt-scene-text-secondary)] ' +
    'hover:border-[var(--vt-scene-text-secondary)] hover:text-[var(--vt-scene-text)] ' +
    'focus-visible:outline-[var(--vt-focus-ring-scene)]',
  paper:
    'border-[var(--vt-scene-paper-line)] text-[var(--vt-scene-paper-text-secondary)] ' +
    'hover:border-[var(--vt-scene-paper-text-secondary)] hover:text-[var(--vt-scene-paper-text)] ' +
    'focus-visible:outline-[var(--vt-focus-ring-scene-paper)]',
};

export function VitalGhostAction({
  label,
  register = 'scene',
  size = 'md',
  href,
  type = 'button',
  disabled = false,
  onClick,
  className,
  'data-testid': testId,
}: VitalGhostActionProps) {
  const shared =
    'inline-flex items-center justify-center whitespace-nowrap rounded-full border font-medium leading-none ' +
    'cursor-pointer bg-transparent transition-colors duration-150 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'disabled:cursor-default disabled:opacity-60 ' +
    `${SIZE[size]} ${REGISTER[register]} ${className ?? ''}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={shared} onClick={onClick} data-testid={testId}>
        {label}
      </Link>
    );
  }

  return (
    <button type={type} className={shared} disabled={disabled} onClick={onClick} data-testid={testId}>
      {label}
    </button>
  );
}
