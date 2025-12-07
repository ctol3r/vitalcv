export class QueueConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueConcurrencyError';
  }
}

export class GlobalConcurrencyGate {
  private active = 0;

  constructor(private readonly label: string, private readonly limit: number) {
    if (limit < 1) {
      throw new Error(`Concurrency limit for ${label} must be at least 1`);
    }
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      throw new QueueConcurrencyError(
        `${this.label} concurrency limit (${this.limit}) already reached`,
      );
    }

    this.active += 1;
    try {
      return await work();
    } finally {
      this.active -= 1;
    }
  }
}

export class KeyedConcurrencyGate {
  private readonly activeKeys = new Set<string>();

  constructor(private readonly label: string) {}

  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (!key) {
      throw new QueueConcurrencyError(`${this.label} requires a non-empty concurrency key`);
    }

    const normalizedKey = key.trim();
    if (!normalizedKey) {
      throw new QueueConcurrencyError(`${this.label} requires a non-empty concurrency key`);
    }

    if (this.activeKeys.has(normalizedKey)) {
      throw new QueueConcurrencyError(
        `${this.label} is already running for key ${normalizedKey}`,
      );
    }

    this.activeKeys.add(normalizedKey);

    try {
      return await work();
    } finally {
      this.activeKeys.delete(normalizedKey);
    }
  }
}

