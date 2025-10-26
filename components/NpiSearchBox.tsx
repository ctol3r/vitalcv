'use client';

/**
 * NPI Search Box - Input with debounce and validation
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidNpi } from '@/lib/npi-client';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface NpiSearchBoxProps {
  onSearch: (npi: string) => void | Promise<void>;
  debounceMs?: number;
  autoSearch?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function NpiSearchBox({
  onSearch,
  debounceMs = 500,
  autoSearch = false,
  placeholder = 'Enter 10-digit NPI (e.g., 1234567890)',
  className,
  disabled = false,
}: NpiSearchBoxProps) {
  const [value, setValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Format input to only allow digits, max 10
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
    setValue(cleaned);
    setError(null);
  };

  // Debounced auto-search
  useEffect(() => {
    if (!autoSearch || !value) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (isValidNpi(value)) {
        handleSearch();
      }
    }, debounceMs);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value, autoSearch, debounceMs]);

  const handleSearch = async () => {
    if (!isValidNpi(value)) {
      setError('NPI must be exactly 10 digits');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      await onSearch(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn('pl-10', error && 'border-destructive focus-visible:ring-destructive')}
            disabled={disabled || isSearching}
            aria-label="NPI search input"
            aria-invalid={!!error}
            aria-describedby={error ? 'npi-error' : undefined}
          />
          {value && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {value.length}/10
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={!isValidNpi(value) || disabled || isSearching}
          aria-label="Search NPI"
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            'Search'
          )}
        </Button>
      </form>

      {error && (
        <div
          id="npi-error"
          className="flex items-center gap-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Enter a valid 10-digit National Provider Identifier (NPI)
      </p>
    </div>
  );
}
