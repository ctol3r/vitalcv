'use client';

import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class DemoErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-border p-6 text-center">
          <p className="text-lg font-semibold text-foreground">
            Something went wrong
          </p>
          <p className="mt-2 text-sm text-muted">
            The demo encountered an unexpected error. Try refreshing the page.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-4 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-theme hover:opacity-80"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
