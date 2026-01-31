import { useId } from 'react'

import { cn } from '@/lib/utils'

type ArchGridProps = {
  className?: string
}

export function ArchGrid({ className }: ArchGridProps) {
  const patternId = useId()

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-0 top-0 h-full w-1/2 text-foreground/10',
        className,
      )}
      viewBox="0 0 400 400"
      fill="none"
    >
      <defs>
        <pattern id={patternId} width="80" height="80" patternUnits="userSpaceOnUse">
          <path
            d="M12 68V40C12 24 24 12 40 12H40C56 12 68 24 68 40V68"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <circle cx="40" cy="46" r="8" stroke="currentColor" strokeWidth="1.2" />
        </pattern>
      </defs>
      <rect width="400" height="400" fill={`url(#${patternId})`} />
    </svg>
  )
}
