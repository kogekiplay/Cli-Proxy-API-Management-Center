declare module 'bun:test' {
  interface Matchers {
    not: Matchers;
    toBe(value: unknown): void;
    toBeGreaterThanOrEqual(value: number): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toContain(value: string): void;
    toEqual(value: unknown): void;
  }

  interface Test {
    (name: string, body: () => void): void;
    each<T extends readonly unknown[]>(
      cases: ReadonlyArray<T>
    ): (name: string, body: (...args: T) => void) => void;
  }

  export const describe: (name: string, body: () => void) => void;
  export const expect: (value: unknown, message?: string) => Matchers;
  export const test: Test;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
}
