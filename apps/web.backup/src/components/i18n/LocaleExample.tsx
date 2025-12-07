/**
 * Example component demonstrating i18n usage
 */

'use client';

import { useTranslation, Translation, useDateFormat, useNumberFormat, useCurrencyConversion, LocaleSelector } from '@/i18n';

export function LocaleExample() {
  const { t, locale, changeLocale } = useTranslation();
  const { formatDate, formatTime, formatRelativeTime } = useDateFormat();
  const { formatNumber, formatCurrency, formatPercentage, formatPlural } = useNumberFormat();
  const { currency, convert, format, loading } = useCurrencyConversion();

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const amount = 1234.56;
  const itemCount = 5;

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">i18n Example</h2>

      {/* Locale Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Select Locale:</label>
        <LocaleSelector
          onChange={(newLocale) => {
            console.log('Locale changed to:', newLocale);
          }}
          className="px-3 py-2 border rounded"
        />
        <p className="text-sm text-gray-600">Current locale: {locale}</p>
      </div>

      {/* Translations */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Translations</h3>
        <p>
          <Translation keyPath="common.save" /> - {t('common.save')}
        </p>
        <p>
          <Translation keyPath="common.cancel" /> - {t('common.cancel')}
        </p>
        <p>
          <Translation keyPath="common.loading" /> - {t('common.loading')}
        </p>
      </div>

      {/* Date Formatting */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Date Formatting</h3>
        <p>Date: {formatDate(now, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p>Time: {formatTime(now)}</p>
        <p>Relative: {formatRelativeTime(yesterday)}</p>
      </div>

      {/* Number Formatting */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Number Formatting</h3>
        <p>Number: {formatNumber(amount)}</p>
        <p>Currency: {formatCurrency(amount, currency)}</p>
        <p>Percentage: {formatPercentage(75)}</p>
        <p>Plural: {formatPlural(itemCount, {
          one: `${itemCount} item`,
          other: `${itemCount} items`
        })}</p>
      </div>

      {/* Currency Conversion */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Currency Conversion</h3>
        <p>Default currency: {currency}</p>
        {loading && <p>Converting...</p>}
        <button
          onClick={async () => {
            const converted = await convert(100, 'USD');
            alert(`100 USD = ${converted} ${currency}`);
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Convert 100 USD
        </button>
      </div>
    </div>
  );
}

