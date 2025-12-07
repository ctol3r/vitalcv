/**
 * B241C-I18N-024: MultiCurrencyDisplay component
 *
 * Shows amounts in preferred currency with hover/display of original currency;
 * fetches conversions via CurrencyConversionEngine; allows toggling between currencies
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { DollarSign, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation, useCurrencyConversion, useNumberFormat, type CurrencyCode } from '@/i18n';
import { cn } from '@/lib/utils';

interface MultiCurrencyDisplayProps {
  amount: number;
  originalCurrency: CurrencyCode;
  preferredCurrency?: CurrencyCode;
  showOriginalOnHover?: boolean;
  showToggle?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  precision?: number;
}

export function MultiCurrencyDisplay({
  amount,
  originalCurrency,
  preferredCurrency,
  showOriginalOnHover = true,
  showToggle = true,
  className,
  size = 'md',
  precision = 2,
}: MultiCurrencyDisplayProps) {
  const { currency: userCurrency, convert, loading } = useCurrencyConversion();
  const { formatCurrency } = useNumberFormat();
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>(
    preferredCurrency || userCurrency
  );
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert currency on mount and when currency changes
  useEffect(() => {
    if (displayCurrency === originalCurrency) {
      setConvertedAmount(amount);
      setError(null);
      return;
    }

    let cancelled = false;

    const performConversion = async () => {
      try {
        setError(null);
        const converted = await convert(amount, originalCurrency, displayCurrency);
        if (!cancelled) {
          setConvertedAmount(converted);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Conversion failed');
          setConvertedAmount(null);
        }
      }
    };

    performConversion();

    return () => {
      cancelled = true;
    };
  }, [amount, originalCurrency, displayCurrency, convert]);

  // Format the amount for display
  const displayAmount = useMemo(() => {
    if (convertedAmount === null) return null;
    return formatCurrency(convertedAmount, displayCurrency, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  }, [convertedAmount, displayCurrency, formatCurrency, precision]);

  // Available currencies for selection
  const availableCurrencies: CurrencyCode[] = [
    'USD',
    'EUR',
    'GBP',
    'JPY',
    'CNY',
    'CAD',
    'AUD',
    'CHF',
    'INR',
    'BRL',
  ];

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-semibold',
  };

  if (error && !convertedAmount) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className={cn('text-muted-foreground', sizeClasses[size])}>
          {formatCurrency(amount, originalCurrency)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDisplayCurrency(displayCurrency);
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      onMouseEnter={() => showOriginalOnHover && setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex items-center gap-2">
        <DollarSign className={cn('text-muted-foreground', sizeClasses[size])} />
        <span className={cn('font-medium', sizeClasses[size])}>
          {loading ? (
            <span className="text-muted-foreground">Loading...</span>
          ) : displayAmount ? (
            <span title={isHovering ? `${formatCurrency(amount, originalCurrency)} (original)` : undefined}>
              {displayAmount}
            </span>
          ) : (
            formatCurrency(amount, originalCurrency)
          )}
        </span>
      </div>

      {showToggle && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {availableCurrencies.map((curr) => (
              <DropdownMenuItem
                key={curr}
                onClick={() => setDisplayCurrency(curr)}
                className={cn(
                  'cursor-pointer',
                  curr === displayCurrency && 'bg-accent'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{curr}</span>
                  {curr === displayCurrency && <span className="text-xs">✓</span>}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {isHovering && showOriginalOnHover && displayCurrency !== originalCurrency && (
        <div className="absolute mt-8 px-2 py-1 bg-popover border rounded shadow-md text-xs text-muted-foreground z-10">
          Original: {formatCurrency(amount, originalCurrency)}
        </div>
      )}
    </div>
  );
}

