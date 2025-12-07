'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { a11yTesting } from '@/lib/accessibility';
import { AlertTriangle, CheckCircle, Eye, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface AccessibilityCheckResult {
  passed: number;
  failed: number;
  errors: string[];
}

export function AccessibilityChecker() {
  const [basicCheckResult, setBasicCheckResult] = useState<AccessibilityCheckResult | null>(null);
  const [contrastCheckResult, setContrastCheckResult] = useState<AccessibilityCheckResult | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);

  const runBasicChecks = async () => {
    setIsRunning(true);
    try {
      const result = a11yTesting.runBasicChecks();
      setBasicCheckResult(result);
    } catch (error) {
      console.error('Accessibility check failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runContrastChecks = async () => {
    setIsRunning(true);
    try {
      const result = a11yTesting.checkColorContrast();
      setContrastCheckResult(result);
    } catch (error) {
      console.error('Contrast check failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runAllChecks = async () => {
    await Promise.all([runBasicChecks(), runContrastChecks()]);
  };

  const getScoreColor = (passed: number, failed: number) => {
    const total = passed + failed;
    if (total === 0) return 'text-gray-500';
    const percentage = (passed / total) * 100;
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (passed: number, failed: number) => {
    const total = passed + failed;
    if (total === 0) return 'secondary';
    const percentage = (passed / total) * 100;
    if (percentage >= 95) return 'default';
    if (percentage >= 85) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            <CardTitle>Accessibility Checker</CardTitle>
          </div>
          <CardDescription>
            Run accessibility checks to ensure WCAG compliance and high Lighthouse scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button onClick={runAllChecks} disabled={isRunning} className="flex-1">
              {isRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Checks...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Run All Checks
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={runBasicChecks} disabled={isRunning} variant="outline">
              Basic Checks
            </Button>
            <Button onClick={runContrastChecks} disabled={isRunning} variant="outline">
              Contrast Checks
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Basic Check Results */}
      {basicCheckResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Basic Accessibility Checks
              </CardTitle>
              <Badge
                variant={getScoreBadgeVariant(basicCheckResult.passed, basicCheckResult.failed)}
              >
                {basicCheckResult.passed + basicCheckResult.failed > 0
                  ? `${Math.round(
                      (basicCheckResult.passed /
                        (basicCheckResult.passed + basicCheckResult.failed)) *
                        100,
                    )}%`
                  : 'N/A'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getScoreColor(
                    basicCheckResult.passed,
                    basicCheckResult.failed,
                  )}`}
                >
                  {basicCheckResult.passed}
                </div>
                <div className="text-sm text-gray-600">Passed</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${
                    basicCheckResult.failed > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {basicCheckResult.failed}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {basicCheckResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Issues Found:</h4>
                {basicCheckResult.errors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {basicCheckResult.errors.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All basic accessibility checks passed! Your page meets basic WCAG guidelines.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contrast Check Results */}
      {contrastCheckResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Color Contrast Checks
              </CardTitle>
              <Badge
                variant={getScoreBadgeVariant(
                  contrastCheckResult.passed,
                  contrastCheckResult.failed,
                )}
              >
                {contrastCheckResult.passed + contrastCheckResult.failed > 0
                  ? `${Math.round(
                      (contrastCheckResult.passed /
                        (contrastCheckResult.passed + contrastCheckResult.failed)) *
                        100,
                    )}%`
                  : 'N/A'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getScoreColor(
                    contrastCheckResult.passed,
                    contrastCheckResult.failed,
                  )}`}
                >
                  {contrastCheckResult.passed}
                </div>
                <div className="text-sm text-gray-600">Passed</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${
                    contrastCheckResult.failed > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {contrastCheckResult.failed}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {contrastCheckResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-red-600">Contrast Issues Found:</h4>
                {contrastCheckResult.errors.map((error, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {contrastCheckResult.errors.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All color contrast checks passed! Your text meets WCAG contrast requirements.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Accessibility Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Accessibility Tips</CardTitle>
          <CardDescription>
            Best practices for achieving high Lighthouse accessibility scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">✅ Essential Requirements:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Provide alt text for all images</li>
                <li>Use semantic HTML elements (h1, h2, nav, main, etc.)</li>
                <li>Ensure proper heading hierarchy (no skipped levels)</li>
                <li>Add labels to all form inputs</li>
                <li>Maintain color contrast ratio of at least 4.5:1</li>
                <li>Make all interactive elements keyboard accessible</li>
                <li>Use ARIA labels for complex UI components</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">🎯 Advanced Tips:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Provide skip navigation links</li>
                <li>Use live regions for dynamic content updates</li>
                <li>Ensure focus indicators are visible</li>
                <li>Test with screen readers</li>
                <li>Provide text alternatives for audio/video content</li>
                <li>Use descriptive link text (avoid "click here")</li>
                <li>Ensure touch targets are at least 44px</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

