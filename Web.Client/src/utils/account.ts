/** Persists the logged-in account's session token in this browser, so a returning
 * visit can silently re-authenticate (see App.tsx's "login_with_token" on connect)
 * instead of asking to log in again every time - same localStorage pattern as
 * savedDecks.ts/settings.ts, no account system of its own. */

const TOKEN_KEY = "xeffigy.accountToken";

export function loadAccountToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAccountToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private window, cleared/blocked storage - login still works for the current
    // session, it just won't be remembered next time.
  }
}

export function clearAccountToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clean up if we can't read/write storage in the first place.
  }
}
