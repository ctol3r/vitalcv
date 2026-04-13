'use client';

/**
 * ApiResponsePreview — live-style API response display.
 * Shows a mock API response with status code, headers, and JSON body
 * in the VitalCV brutalist visual language.
 */

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Clock } from 'lucide-react';
import { CodeBlock } from './code-block';

interface ApiResponsePreviewProps {
  /** HTTP method */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  /** Endpoint path */
  endpoint: string;
  /** HTTP status code */
  statusCode?: number;
  /** Response time display */
  responseTime?: string;
  /** JSON response body */
  body: string;
  className?: string;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-[oklch(0.7_0.14_155)] bg-[oklch(0.7_0.14_155)]/10',
  POST: 'text-[oklch(0.7_0.12_220)] bg-[oklch(0.7_0.12_220)]/10',
  PUT: 'text-[oklch(0.7_0.13_40)] bg-[oklch(0.7_0.13_40)]/10',
  PATCH: 'text-[oklch(0.7_0.13_310)] bg-[oklch(0.7_0.13_310)]/10',
};

function ResponseContent({
  method,
  endpoint,
  statusCode,
  responseTime,
  body,
  isSuccess,
}: {
  method: string;
  endpoint: string;
  statusCode: number;
  responseTime: string;
  body: string;
  isSuccess: boolean;
}) {
  return (
    <>
      {/* Request line */}
      <div className="flex items-center gap-3 border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-4 py-2.5">
        <span
          className={cn(
            'px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-sm',
            METHOD_COLORS[method],
          )}
        >
          {method}
        </span>
        <span className="text-xs font-mono text-[var(--vt-text-secondary)] truncate">
          {endpoint}
        </span>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-b border-[var(--vt-border)] px-4 py-2">
        <div className="flex items-center gap-2">
          {isSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--vt-status-resolved)]" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-[var(--vt-severity-high)]" />
          )}
          <span
            className={cn(
              'text-xs font-mono font-bold',
              isSuccess
                ? 'text-[var(--vt-status-resolved)]'
                : 'text-[var(--vt-severity-critical)]',
            )}
          >
            {statusCode} {isSuccess ? 'OK' : 'Error'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--vt-text-muted)]">
          <Clock className="h-3 w-3" />
          {responseTime}
        </div>
      </div>

      {/* Response body */}
      <CodeBlock
        code={body}
        language="json"
        className="border-0 rounded-none"
        maxHeight="20rem"
      />
    </>
  );
}

export function ApiResponsePreview({
  method = 'GET',
  endpoint,
  statusCode = 200,
  responseTime = '127ms',
  body,
  className,
}: ApiResponsePreviewProps) {
  const reducedMotion = useReducedMotion();
  const isSuccess = statusCode >= 200 && statusCode < 300;

  const wrapperClass = cn(
    'rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] overflow-hidden',
    className,
  );

  const inner = (
    <ResponseContent
      method={method}
      endpoint={endpoint}
      statusCode={statusCode}
      responseTime={responseTime}
      body={body}
      isSuccess={isSuccess}
    />
  );

  if (reducedMotion) {
    return <div className={wrapperClass}>{inner}</div>;
  }

  return (
    <motion.div
      className={wrapperClass}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      }}
    >
      {inner}
    </motion.div>
  );
}

export type { ApiResponsePreviewProps };
