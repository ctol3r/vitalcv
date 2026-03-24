declare module 'vitest' {
  type AsyncResult<T = unknown> = T | Promise<T>;
  type MatcherFn = (...args: readonly unknown[]) => unknown;
  type MatcherMap = Record<string, MatcherFn>;

  interface TestContext extends Record<string, unknown> {}

  interface TestAPI {
    (name: string, fn?: (context: TestContext) => AsyncResult<unknown>, timeout?: number): void;
    only: TestAPI;
    skip: TestAPI;
    todo: (name?: string) => void;
    each: (...cases: readonly unknown[]) => TestAPI;
  }

  interface HookAPI {
    (fn: (context: TestContext) => AsyncResult<unknown>, timeout?: number): void;
  }

  type Expectation = MatcherMap & {
    not: MatcherMap;
    resolves: MatcherMap;
    rejects: MatcherMap;
  };

  interface ExpectStatic {
    (value?: unknown): Expectation;
    anything(): unknown;
    any(constructor: unknown): unknown;
    arrayContaining(values: readonly unknown[]): unknown;
    objectContaining(value: Record<string, unknown>): unknown;
    stringContaining(value: string): unknown;
    stringMatching(value: string | RegExp): unknown;
    assertions(count?: number): void;
    hasAssertions(): void;
  }

  interface ViFn extends MatcherMap {
    (...args: readonly unknown[]): unknown;
    mockImplementation(fn: (...args: readonly unknown[]) => unknown): ViFn;
    mockImplementationOnce(fn: (...args: readonly unknown[]) => unknown): ViFn;
    mockReturnValue(value: unknown): ViFn;
    mockReturnValueOnce(value: unknown): ViFn;
    mockResolvedValue(value: unknown): ViFn;
    mockResolvedValueOnce(value: unknown): ViFn;
    mockRejectedValue(value: unknown): ViFn;
    mockRejectedValueOnce(value: unknown): ViFn;
    mockClear(): ViFn;
    mockReset(): ViFn;
    mockRestore(): ViFn;
  }

  interface ViStatic extends MatcherMap {
    fn(implementation?: (...args: readonly unknown[]) => unknown): ViFn;
    spyOn<T extends object, K extends keyof T>(object: T, method: K): ViFn;
    mock(path: string, factory?: (...args: readonly unknown[]) => unknown): void;
    mocked<T>(value: T): T;
    clearAllMocks(): void;
    resetAllMocks(): void;
    restoreAllMocks(): void;
    useFakeTimers(): void;
    useRealTimers(): void;
    advanceTimersByTime(ms: number): void;
    setSystemTime(value: number | Date): void;
  }

  export const describe: TestAPI;
  export const suite: TestAPI;
  export const it: TestAPI;
  export const test: TestAPI;
  export const beforeEach: HookAPI;
  export const afterEach: HookAPI;
  export const beforeAll: HookAPI;
  export const afterAll: HookAPI;
  export const expect: ExpectStatic;
  export const vi: ViStatic;
}

declare module 'vitest/config' {
  export function defineConfig<T extends Record<string, unknown>>(config: T): T;
}
