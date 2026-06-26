import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('startup loading experience', () => {
  test('does not force the login splash on every remembered-session refresh', () => {
    const loginPage = read('src/pages/LoginPage.tsx');
    const protectedRoute = read('src/router/ProtectedRoute.tsx');

    expect(loginPage).toContain('STARTUP_SPLASH_DELAY_MS');
    expect(loginPage).toContain('autoLoading && showDelayedSplash');
    expect(loginPage).toContain('navigate(redirect, { replace: true });');
    expect(loginPage).not.toContain('autoLoginSuccess');
    expect(loginPage).not.toContain('1500');
    expect(loginPage).not.toMatch(
      /setTimeout\(\(\) => \{\s*const redirect = [\s\S]*?navigate\(redirect[\s\S]*?\}, 1500\)/
    );

    expect(protectedRoute).toContain('hasStoredCredentials');
    expect(protectedRoute).toContain('showCheckingFeedback');
    expect(protectedRoute).toContain('return showCheckingFeedback ?');

    const guardedRestore = protectedRoute.indexOf('if (!isAuthenticated && hasStoredCredentials');
    const loginRedirect = protectedRoute.indexOf('if (!isAuthenticated)');

    expect(guardedRestore).toBeGreaterThanOrEqual(0);
    expect(loginRedirect).toBeGreaterThanOrEqual(0);
    expect(guardedRestore).toBeLessThan(loginRedirect);
  });
});
