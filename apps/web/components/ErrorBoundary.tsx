'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bug, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  maxRetries?: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  render() {
    const { hasError, error, retryCount } = this.state;
    const { children, fallback, maxRetries = 3 } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">Something went wrong</CardTitle>
              <CardDescription className="text-lg">
                We encountered an unexpected error. Don't worry, your data is safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <Bug className="h-4 w-4" />
                  <AlertDescription>
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium">
                        Error Details (Click to expand)
                      </summary>
                      <div className="mt-2 p-3 bg-red-50 rounded text-sm font-mono">
                        <div className="font-semibold text-red-800">Error:</div>
                        <div className="text-red-700">{error.message}</div>
                        {error.stack && (
                          <>
                            <div className="font-semibold text-red-800 mt-2">Stack Trace:</div>
                            <pre className="text-red-700 text-xs overflow-auto max-h-32">
                              {error.stack}
                            </pre>
                          </>
                        )}
                      </div>
                    </details>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {retryCount < maxRetries && (
                  <Button
                    onClick={this.handleRetry}
                    className="flex-1"
                    aria-label={`Retry (attempt ${retryCount + 1} of ${maxRetries})`}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again ({retryCount + 1}/{maxRetries})
                  </Button>
                )}

                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                  aria-label="Reset and reload"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>

                <Link href="/" className="flex-1">
                  <Button variant="outline" className="w-full" aria-label="Go to home page">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </Link>
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>
                  If this problem persists, please contact support or try refreshing the page.
                </p>
                <p className="mt-1">
                  Error ID: {Date.now().toString(36)}-{Math.random().toString(36).substr(2, 9)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return children;
  }
}

// Specialized error boundaries for different contexts
export class ApiErrorBoundary extends ErrorBoundary {
  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="font-semibold text-red-800">API Error</h3>
            </div>
            <p className="text-red-700 mb-4">
              Failed to connect to the backend service. Please check your connection and try again.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={this.handleRetry}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button
                onClick={this.handleReset}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Reset
              </Button>
            </div>
            {error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-red-600">
                  Technical Details
                </summary>
                <pre className="mt-2 text-xs text-red-500 overflow-auto">
                  {error.message}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

export class FormErrorBoundary extends ErrorBoundary {
  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>Form submission failed. Please try again.</p>
              <div className="flex gap-2">
                <Button
                  onClick={this.handleRetry}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                <Button
                  onClick={this.handleReset}
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100"
                >
                  Reset Form
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return children;
  }
}

// Hook for error handling with retry logic
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    // You could integrate with error reporting services here
    // e.g., Sentry.captureException(error, { tags: { context } });
  };

  const withRetry = async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const waitTime = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw lastError!;
  };

  return { handleError, withRetry };
}
