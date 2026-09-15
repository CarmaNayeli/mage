/** Per-browser preferences, same localStorage pattern as savedDecks.ts - no account
 * system, nothing synced, just remembers a choice on this device. */

const TABLE_TALK_KEY = "xeffigy.tableTalk";

export function loadTableTalk(): boolean {
  try {
    const raw = localStorage.getItem(TABLE_TALK_KEY);
    return raw === null ? false : raw === "true";
  } catch {
    return false;
  }
}

export function saveTableTalk(enabled: boolean): void {
  try {
    localStorage.setItem(TABLE_TALK_KEY, String(enabled));
  } catch {
    // Private window, cleared/blocked storage - the toggle still works for the
    // current session, it just won't be remembered next time.
  }
}
