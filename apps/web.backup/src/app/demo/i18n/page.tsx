/**
 * B252C-I18N-030: LocalizationDemo Page
 *
 * Demonstration page showing localized content: displays sample text, dates, numbers,
 * currency, units with user-selected locale; includes locale switcher; accessible and responsive
 */

'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { CurrencyDisplay } from '@/components/i18n/CurrencyDisplay';
import { DateTimeDisplay } from '@/components/i18n/DateTimeDisplay';
import { UnitDisplay } from '@/components/i18n/UnitDisplay';
import { useTranslation } from '@/i18n';
import { Globe, DollarSign, Calendar, Ruler } from 'lucide-react';

export default function LocalizationDemoPage() {
  const { t, locale } = useTranslation();
  const [sampleDate] = useState(new Date());
  const [sampleAmount] = useState(1234.56);
  const [sampleTemperature] = useState(25);
  const [sampleLength] = useState(100);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Localization Demo</h1>
          <p className="text-gray-600">
            Demonstration of internationalization features
          </p>
        </div>
        <LocaleSwitcher variant="dropdown" />
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Current Locale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{locale}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Change the locale using the switcher above to see how content adapts
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Currency Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Currency Formatting
            </CardTitle>
            <CardDescription>
              Currency values formatted according to locale
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">USD Amount</p>
              <p className="text-2xl font-bold">
                <CurrencyDisplay amount={sampleAmount} currencyCode="USD" />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">EUR Amount</p>
              <p className="text-2xl font-bold">
                <CurrencyDisplay amount={sampleAmount} currencyCode="EUR" />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">JPY Amount</p>
              <p className="text-2xl font-bold">
                <CurrencyDisplay amount={sampleAmount} currencyCode="JPY" />
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Date/Time Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Date & Time Formatting
            </CardTitle>
            <CardDescription>
              Dates and times formatted according to locale
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Date</p>
              <p className="text-lg font-medium">
                <DateTimeDisplay value={sampleDate} mode="date" />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Time</p>
              <p className="text-lg font-medium">
                <DateTimeDisplay value={sampleDate} mode="time" />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Date & Time</p>
              <p className="text-lg font-medium">
                <DateTimeDisplay value={sampleDate} mode="datetime" />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Relative Time</p>
              <p className="text-lg font-medium">
                <DateTimeDisplay value={sampleDate} mode="relative" />
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Unit Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="w-5 h-5" />
              Unit Conversion
            </CardTitle>
            <CardDescription>
              Units converted based on locale preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Temperature</p>
              <p className="text-2xl font-bold">
                <UnitDisplay
                  value={sampleTemperature}
                  fromUnit="celsius"
                  unitType="temperature"
                  showOriginal
                />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Length</p>
              <p className="text-2xl font-bold">
                <UnitDisplay
                  value={sampleLength}
                  fromUnit="cm"
                  unitType="length"
                  showOriginal
                />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Weight</p>
              <p className="text-2xl font-bold">
                <UnitDisplay
                  value={5}
                  fromUnit="kg"
                  unitType="weight"
                  showOriginal
                />
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sample Translations */}
        <Card>
          <CardHeader>
            <CardTitle>Sample Translations</CardTitle>
            <CardDescription>
              Example translated text using the current locale
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Common Actions</p>
              <div className="space-y-2">
                <p className="font-medium">
                  Save: {t('common.save', { defaultValue: 'Save' })}
                </p>
                <p className="font-medium">
                  Cancel: {t('common.cancel', { defaultValue: 'Cancel' })}
                </p>
                <p className="font-medium">
                  Delete: {t('common.delete', { defaultValue: 'Delete' })}
                </p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Status Messages</p>
              <div className="space-y-2">
                <p className="font-medium">
                  Loading: {t('common.loading', { defaultValue: 'Loading...' })}
                </p>
                <p className="font-medium">
                  Success: {t('common.success', { defaultValue: 'Success' })}
                </p>
                <p className="font-medium">
                  Error: {t('common.error', { defaultValue: 'Error' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Use the locale switcher in the top right to change the current language
            </li>
            <li>
              Observe how currency, dates, times, and units change based on the selected
              locale
            </li>
            <li>
              Notice that translations adapt to the selected language (if translations are
              available)
            </li>
            <li>
              All components are accessible and support keyboard navigation
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

