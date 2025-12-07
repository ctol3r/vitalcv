'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Info } from 'lucide-react';

export interface CompactFilterState {
  compactOnly: boolean;
  specificCompacts: {
    imlc: boolean;
    psypact: boolean;
    counseling: boolean;
  };
}

interface CompactFilterProps {
  /** Current filter state */
  value: CompactFilterState;
  /** Callback when filter changes */
  onChange: (filter: CompactFilterState) => void;
  /** Number of jobs matching current compact filter */
  matchCount?: number;
  /** Total number of jobs */
  totalCount?: number;
  /** Disable the filter */
  disabled?: boolean;
  /** Compact layout mode */
  compact?: boolean;
}

/**
 * Org Job Filters: Compact-Only Jobs Toggle
 *
 * Toggle to filter jobs that accept compact-eligible clinicians
 * Works in combination with other filters
 *
 * Acceptance Criteria:
 * - Toggle shows only jobs w/compactAllowed
 * - Combination with other filters tested
 * - Accessible with keyboard navigation
 * - Screen reader friendly
 *
 * @example
 * ```tsx
 * const [filters, setFilters] = useState({
 *   compactOnly: false,
 *   specificCompacts: { imlc: false, psypact: false, counseling: false }
 * });
 *
 * <CompactFilter
 *   value={filters}
 *   onChange={setFilters}
 *   matchCount={25}
 *   totalCount={100}
 * />
 * ```
 */
export function CompactFilter({
  value,
  onChange,
  matchCount,
  totalCount,
  disabled = false,
  compact = false,
}: CompactFilterProps) {
  const handleToggleCompactOnly = (checked: boolean) => {
    onChange({
      ...value,
      compactOnly: checked,
      // Reset specific compacts if turning off compact filter
      specificCompacts: checked ? value.specificCompacts : {
        imlc: false,
        psypact: false,
        counseling: false,
      },
    });
  };

  const handleToggleSpecificCompact = (
    compactType: keyof CompactFilterState['specificCompacts'],
    checked: boolean
  ) => {
    onChange({
      ...value,
      specificCompacts: {
        ...value.specificCompacts,
        [compactType]: checked,
      },
    });
  };

  const hasSpecificCompactSelected =
    value.specificCompacts.imlc ||
    value.specificCompacts.psypact ||
    value.specificCompacts.counseling;

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Switch
          id="compact-filter"
          checked={value.compactOnly}
          onCheckedChange={handleToggleCompactOnly}
          disabled={disabled}
          aria-label="Filter to compact-eligible jobs only"
        />
        <Label
          htmlFor="compact-filter"
          className="text-sm font-medium cursor-pointer flex items-center gap-1.5"
        >
          <MapPin className="h-4 w-4" aria-hidden="true" />
          Compact OK
          {matchCount !== undefined && totalCount !== undefined && value.compactOnly && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {matchCount}/{totalCount}
            </Badge>
          )}
        </Label>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" aria-hidden="true" />
          Compact-Eligible Jobs
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="ml-auto text-gray-400 hover:text-gray-600"
                  aria-label="Information about compact-eligible jobs"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Filter jobs that accept clinicians with interstate compact memberships
                  (IMLC, PSYPACT, or Counseling Compact). These jobs allow practice across
                  multiple states without individual state licenses.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardTitle>
        <CardDescription className="text-xs">
          Show jobs accepting compact memberships
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label
              htmlFor="compact-only-switch"
              className="text-sm font-medium cursor-pointer"
            >
              Compact-eligible only
            </Label>
            {matchCount !== undefined && totalCount !== undefined && (
              <p className="text-xs text-gray-500">
                {value.compactOnly
                  ? `Showing ${matchCount} of ${totalCount} jobs`
                  : `${matchCount} jobs accept compact licenses`}
              </p>
            )}
          </div>
          <Switch
            id="compact-only-switch"
            checked={value.compactOnly}
            onCheckedChange={handleToggleCompactOnly}
            disabled={disabled}
            aria-label="Toggle compact-eligible jobs filter"
            aria-describedby="compact-filter-description"
          />
        </div>

        {/* Specific Compact Types */}
        {value.compactOnly && (
          <div
            className="pt-3 border-t space-y-3"
            role="group"
            aria-labelledby="specific-compacts-label"
          >
            <Label id="specific-compacts-label" className="text-xs font-medium text-gray-600">
              Filter by specific compact (optional)
            </Label>

            <div className="space-y-2.5">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="imlc-filter"
                  checked={value.specificCompacts.imlc}
                  onCheckedChange={(checked) =>
                    handleToggleSpecificCompact('imlc', checked as boolean)
                  }
                  disabled={disabled}
                  aria-label="Filter to IMLC jobs"
                />
                <Label
                  htmlFor="imlc-filter"
                  className="text-sm cursor-pointer flex items-center gap-2"
                >
                  <span>IMLC</span>
                  <Badge
                    variant="outline"
                    className="text-xs border-blue-300 text-blue-700 dark:text-blue-300"
                  >
                    Medical
                  </Badge>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="psypact-filter"
                  checked={value.specificCompacts.psypact}
                  onCheckedChange={(checked) =>
                    handleToggleSpecificCompact('psypact', checked as boolean)
                  }
                  disabled={disabled}
                  aria-label="Filter to PSYPACT jobs"
                />
                <Label
                  htmlFor="psypact-filter"
                  className="text-sm cursor-pointer flex items-center gap-2"
                >
                  <span>PSYPACT</span>
                  <Badge
                    variant="outline"
                    className="text-xs border-purple-300 text-purple-700 dark:text-purple-300"
                  >
                    Psychology
                  </Badge>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="counseling-filter"
                  checked={value.specificCompacts.counseling}
                  onCheckedChange={(checked) =>
                    handleToggleSpecificCompact('counseling', checked as boolean)
                  }
                  disabled={disabled}
                  aria-label="Filter to Counseling Compact jobs"
                />
                <Label
                  htmlFor="counseling-filter"
                  className="text-sm cursor-pointer flex items-center gap-2"
                >
                  <span>Counseling Compact</span>
                  <Badge
                    variant="outline"
                    className="text-xs border-green-300 text-green-700 dark:text-green-300"
                  >
                    Counseling
                  </Badge>
                </Label>
              </div>
            </div>

            {!hasSpecificCompactSelected && (
              <p className="text-xs text-gray-500 italic pt-1">
                No specific compact selected - showing all compact-eligible jobs
              </p>
            )}
          </div>
        )}
      </CardContent>

      <span id="compact-filter-description" className="sr-only">
        When enabled, only jobs that accept compact-eligible clinicians will be shown.
        You can optionally filter by specific compact types.
      </span>
    </Card>
  );
}

/**
 * Utility function to filter jobs based on compact filter state
 *
 * @example
 * ```tsx
 * const filteredJobs = jobs.filter(job =>
 *   matchesCompactFilter(job, compactFilterState)
 * );
 * ```
 */
export function matchesCompactFilter(
  job: {
    compactAllowed?: boolean;
    imlcEligible?: boolean;
    psypactEligible?: boolean;
    counselingCompactEligible?: boolean;
    multiStateOk?: boolean;
  },
  filter: CompactFilterState
): boolean {
  // If compact filter is off, include all jobs
  if (!filter.compactOnly) {
    return true;
  }

  // Check if job accepts any compact
  const isCompactJob = Boolean(
    job.compactAllowed ||
    job.imlcEligible ||
    job.psypactEligible ||
    job.counselingCompactEligible ||
    job.multiStateOk
  );

  // If compact filter is on but no specific compacts selected
  // Show all compact-eligible jobs
  const hasSpecificFilter =
    filter.specificCompacts.imlc ||
    filter.specificCompacts.psypact ||
    filter.specificCompacts.counseling;

  if (!hasSpecificFilter) {
    return isCompactJob;
  }

  // Check specific compact matches
  let matches = false;

  if (filter.specificCompacts.imlc && job.imlcEligible) {
    matches = true;
  }

  if (filter.specificCompacts.psypact && job.psypactEligible) {
    matches = true;
  }

  if (filter.specificCompacts.counseling && job.counselingCompactEligible) {
    matches = true;
  }

  return matches;
}

/**
 * Utility to get compact filter summary text
 */
export function getCompactFilterSummary(filter: CompactFilterState): string {
  if (!filter.compactOnly) {
    return 'All jobs';
  }

  const { imlc, psypact, counseling } = filter.specificCompacts;
  const selected = [];

  if (imlc) selected.push('IMLC');
  if (psypact) selected.push('PSYPACT');
  if (counseling) selected.push('Counseling');

  if (selected.length === 0) {
    return 'All compact-eligible jobs';
  }

  if (selected.length === 1) {
    return `${selected[0]} jobs`;
  }

  if (selected.length === 2) {
    return `${selected.join(' & ')} jobs`;
  }

  return `IMLC, PSYPACT & Counseling jobs`;
}

