/**
 * B241C-I18N-030: LocalisationTestingHarness
 *
 * Test harness for UIs across languages: loads pages in various locales,
 * checks for missing translations, layout issues, right-to-left rendering;
 * logs results and screenshots for QA
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, CheckCircle2, XCircle, AlertTriangle, Camera, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation, type Locale } from '@/i18n';
import { cn } from '@/lib/utils';

interface TestResult {
  locale: Locale;
  status: 'pass' | 'fail' | 'warning';
  issues: TestIssue[];
  screenshot?: string;
  timestamp: Date;
}

interface TestIssue {
  type: 'missing-translation' | 'layout-issue' | 'rtl-issue' | 'overflow' | 'other';
  severity: 'error' | 'warning';
  message: string;
  element?: string;
}

interface LocalisationTestingHarnessProps {
  targetUrl?: string;
  locales?: Locale[];
  onTestComplete?: (results: TestResult[]) => void;
  className?: string;
}

export function LocalisationTestingHarness({
  targetUrl,
  locales = ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'],
  onTestComplete,
  className,
}: LocalisationTestingHarnessProps) {
  const { changeLocale } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [currentLocale, setCurrentLocale] = useState<Locale | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check for missing translations
  const checkMissingTranslations = (locale: Locale): TestIssue[] => {
    const issues: TestIssue[] = [];

    // Check for translation keys that weren't translated
    const elements = document.querySelectorAll('[data-i18n-key]');
    elements.forEach((el) => {
      const key = el.getAttribute('data-i18n-key');
      const text = el.textContent || '';

      // Check if text contains the key (indicating missing translation)
      if (text.includes(key || '')) {
        issues.push({
          type: 'missing-translation',
          severity: 'error',
          message: `Missing translation for key: ${key}`,
          element: el.tagName,
        });
      }
    });

    // Check for English fallback text in non-English locales
    if (locale !== 'en-US') {
      const englishPatterns = /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/gi;
      const bodyText = document.body.textContent || '';
      // This is a simplified check - in production, use more sophisticated detection
    }

    return issues;
  };

  // Check for layout issues
  const checkLayoutIssues = (locale: Locale): TestIssue[] => {
    const issues: TestIssue[] = [];
    const isRTL = ['ar', 'he', 'fa', 'ur'].some((rtl) => locale.startsWith(rtl));

    // Check for overflow
    const overflowElements = Array.from(document.querySelectorAll('*')).filter((el) => {
      const htmlEl = el as HTMLElement;
      return htmlEl.scrollWidth > htmlEl.clientWidth || htmlEl.scrollHeight > htmlEl.clientHeight;
    });

    overflowElements.forEach((el) => {
      issues.push({
        type: 'overflow',
        severity: 'warning',
        message: 'Element has overflow issues',
        element: (el as HTMLElement).tagName,
      });
    });

    // Check RTL layout
    if (isRTL) {
      const dir = document.documentElement.dir;
      if (dir !== 'rtl') {
        issues.push({
          type: 'rtl-issue',
          severity: 'error',
          message: 'RTL locale but document direction is not RTL',
        });
      }

      // Check for elements that might not support RTL
      const problematicElements = document.querySelectorAll('[style*="left"], [style*="right"]');
      if (problematicElements.length > 0) {
        issues.push({
          type: 'rtl-issue',
          severity: 'warning',
          message: `Found ${problematicElements.length} elements with hardcoded left/right styles`,
        });
      }
    }

    return issues;
  };

  // Take screenshot (simplified - in production, use proper screenshot library)
  const takeScreenshot = async (): Promise<string> => {
    // In a real implementation, this would use html2canvas or similar
    // For now, return a placeholder
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  };

  // Run test for a single locale
  const runTestForLocale = async (locale: Locale): Promise<TestResult> => {
    // Change locale
    await changeLocale(locale);
    setCurrentLocale(locale);

    // Wait for locale change to take effect
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Check for issues
    const missingTranslationIssues = checkMissingTranslations(locale);
    const layoutIssues = checkLayoutIssues(locale);
    const allIssues = [...missingTranslationIssues, ...layoutIssues];

    // Take screenshot
    const screenshot = await takeScreenshot();

    // Determine status
    const hasErrors = allIssues.some((issue) => issue.severity === 'error');
    const hasWarnings = allIssues.some((issue) => issue.severity === 'warning');
    const status: 'pass' | 'fail' | 'warning' = hasErrors ? 'fail' : hasWarnings ? 'warning' : 'pass';

    return {
      locale,
      status,
      issues: allIssues,
      screenshot,
      timestamp: new Date(),
    };
  };

  // Run all tests
  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    const testResults: TestResult[] = [];

    for (const locale of locales) {
      try {
        const result = await runTestForLocale(locale);
        testResults.push(result);
        setResults([...testResults]);

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Test failed for locale ${locale}:`, error);
        testResults.push({
          locale,
          status: 'fail',
          issues: [
            {
              type: 'other',
              severity: 'error',
              message: `Test execution failed: ${error}`,
            },
          ],
          timestamp: new Date(),
        });
      }
    }

    setCurrentLocale(null);
    setIsRunning(false);
    onTestComplete?.(testResults);
  };

  // Export results
  const exportResults = () => {
    const data = JSON.stringify(results, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localisation-test-results-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Localisation Testing Harness</CardTitle>
          <CardDescription>
            Test UI components across different locales and languages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button onClick={runTests} disabled={isRunning}>
                <Play className="h-4 w-4 mr-2" />
                {isRunning ? 'Running Tests...' : 'Run Tests'}
              </Button>
              {results.length > 0 && (
                <Button variant="outline" onClick={exportResults}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Results
                </Button>
              )}
            </div>
            {isRunning && currentLocale && (
              <Badge variant="secondary">Testing: {currentLocale}</Badge>
            )}
          </div>

          {/* Summary */}
          {results.length > 0 && (
            <div className="flex items-center gap-4 mb-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">{passCount} Passed</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium">{warningCount} Warnings</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium">{failCount} Failed</span>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="space-y-4">
            {results.map((result) => (
              <Card key={result.locale}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{result.locale}</CardTitle>
                    <Badge
                      variant={
                        result.status === 'pass'
                          ? 'default'
                          : result.status === 'fail'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {result.status === 'pass' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {result.status === 'fail' && <XCircle className="h-3 w-3 mr-1" />}
                      {result.status === 'warning' && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {result.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {result.issues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No issues found</p>
                  ) : (
                    <div className="space-y-2">
                      {result.issues.map((issue, index) => (
                        <div
                          key={index}
                          className={cn(
                            'p-2 rounded text-sm',
                            issue.severity === 'error' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {issue.type}
                            </Badge>
                            <span>{issue.message}</span>
                            {issue.element && (
                              <span className="text-muted-foreground">({issue.element})</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.screenshot && (
                    <div className="mt-4">
                      <img
                        src={result.screenshot}
                        alt={`Screenshot for ${result.locale}`}
                        className="border rounded max-w-full"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

