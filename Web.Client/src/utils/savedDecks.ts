/**
 * "My Decks" - decklists saved in this browser's localStorage so a returning player
 * doesn't have to re-paste the same list every time. There's no account system behind
 * this (see DeckEntry.tsx) - it's per-browser, not synced anywhere, and can vanish if
 * the user clears site data. Good enough for a practice tool; a real account-backed
 * deck library would be a much bigger feature.
 */

export interface SavedDeck {
  name: string;
  format: string;
  playerDeck: string;
  sideboard: string;
}

const STORAGE_KEY = "xeffigy.savedDecks";

function readAll(): SavedDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Private window, cleared/blocked storage, corrupted JSON - degrade to "no decks
    // saved" rather than crashing the join screen over a convenience feature.
    return [];
  }
}

function writeAll(decks: SavedDeck[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  } catch {
    // Ignore - e.g. storage quota or a private window that throws on write.
  }
}

export function listSavedDecks(): SavedDeck[] {
  return readAll();
}

/** Saving under a name that already exists overwrites it. */
export function saveDeck(deck: SavedDeck): SavedDeck[] {
  const decks = readAll().filter((d) => d.name !== deck.name);
  decks.push(deck);
  decks.sort((a, b) => a.name.localeCompare(b.name));
  writeAll(decks);
  return decks;
}

export function deleteDeck(name: string): SavedDeck[] {
  const decks = readAll().filter((d) => d.name !== name);
  writeAll(decks);
  return decks;
}
