// Minimal metrics-core implementation
export function emitMetric(name: string, labels: Record<string, string | number | boolean>): void {
  // Stub implementation - can be enhanced later
  if (process.env.NODE_ENV === 'development') {
    console.log(`[metrics] ${name}`, labels);
  }
}

export function createMetricsRegistry() {
  return {
    counter: (name: string) => ({
      inc: (labels?: Record<string, string>) => {},
    }),
    histogram: (name: string) => ({
      observe: (value: number, labels?: Record<string, string>) => {},
    }),
    gauge: (name: string) => ({
      set: (value: number, labels?: Record<string, string>) => {},
    }),
  };
}

export function createTimer() {
  return {
    start: () => {},
    end: (labels?: Record<string, string>) => {},
  };
}

