import { forwardRef, useImperativeHandle, useState } from "react";
import { deleteDeck, saveDeck, type SavedDeck } from "../utils/savedDecks";

export type OpponentMode = "provide" | "basic" | "counter";
export type Difficulty = "easy" | "medium" | "hard";

export interface JoinRequest {
  playerName: string;
  format: string;
  playerDeck: string;
  opponentMode: OpponentMode;
  opponentDeck?: string;
  difficulty?: Difficulty;
}

interface DeckEntryProps {
  onSubmit: (request: JoinRequest) => void;
  disabled?: boolean;
  error?: string | null;
  /** The gateway's current "here's what I'm doing" update while joining - shown
   * instead of a static "Joining..." for the whole (sometimes tens-of-seconds-long,
   * for AI counter-deck generation) duration. */
  progress?: string | null;
  /** Owned by App.tsx (not local state here) so the hamburger menu's "Load Deck"
   * submenu and this form's own inline "My Decks" panel always agree on what's saved -
   * both read/write through the same list instead of two independent copies. Optional
   * (defaulting to an inert empty list) so callers that don't care about the
   * cross-component menu sync - tests, mainly - don't need to wire it up.
   * Ignored (see accountDecks below) once logged into an account. */
  savedDecks?: SavedDeck[];
  onSavedDecksChange?: (decks: SavedDeck[]) => void;
  /** Non-null (even if empty) once logged into an account - switches "My Decks" from
   * this browser's localStorage to the account's real, server-stored decks instead.
   * Only name/format are known up front (the list, not each deck's full content) -
   * loading one is necessarily async (see onAccountLoadDeck), unlike a localStorage
   * SavedDeck which already carries everything. */
  accountDecks?: Array<{ name: string; format: string | null }> | null;
  onAccountSaveDeck?: (name: string, format: string, deck: string) => void;
  /** Fire-and-forget - the actual content arrives later over the wire and reaches this
   * form via the ref's loadDeck, not a return value here. */
  onAccountLoadDeck?: (name: string) => void;
  onAccountDeleteDeck?: (name: string) => void;
}

/** Lets App.tsx's hamburger menu reach into this form for "Load Deck" (from its
 * submenu) and "Save Deck" (reads the current fields to save) without lifting every
 * field of the form up as controlled props - only the saved-decks *list* is shared
 * state (see savedDecks/onSavedDecksChange above); the in-progress form values stay
 * local to this component. */
export interface DeckEntryHandle {
  loadDeck: (deck: SavedDeck) => void;
  getCurrentDeck: () => { format: string; playerDeck: string; sideboard: string };
}

const PLACEHOLDER = `Paste a decklist, one card per line, e.g.:

4 Lightning Bolt
20 Mountain
4 Grizzly Bears
...`;

/** Matches Web.Gateway's Format enum ids exactly (Format.java). */
const FORMATS: Array<{ id: string; label: string }> = [
  { id: "freeform", label: "Freeform (no restrictions)" },
  { id: "standard", label: "Standard" },
  { id: "pioneer", label: "Pioneer" },
  { id: "modern", label: "Modern" },
  { id: "legacy", label: "Legacy" },
  { id: "vintage", label: "Vintage" },
  { id: "pauper", label: "Pauper" },
  { id: "commander", label: "Commander" },
];

/** TxtDeckImporter (as Web.Gateway's DeckSubmission calls it) switches everything
 * after the first blank line to the sideboard automatically - no special syntax
 * needed, just a real blank line. That's the only way it recognizes a commander. */
export function withSideboard(deckText: string, sideboardText: string): string {
  return sideboardText.trim() ? `${deckText}\n\n${sideboardText}` : deckText;
}

/** The inverse - an account deck is stored as one combined blob (the same shape
 * withSideboard produces, since that's also what actually gets submitted to join a
 * game), but this form's two separate textareas need it split back apart to round-trip
 * the same way a localStorage SavedDeck already does. Splits on the first blank line,
 * matching TxtDeckImporter's own convention exactly. */
export function splitSideboard(combined: string): { playerDeck: string; sideboard: string } {
  const splitAt = combined.indexOf("\n\n");
  if (splitAt === -1) {
    return { playerDeck: combined, sideboard: "" };
  }
  return { playerDeck: combined.slice(0, splitAt), sideboard: combined.slice(splitAt + 2) };
}

export const DeckEntry = forwardRef<DeckEntryHandle, DeckEntryProps>(function DeckEntry(
  {
    onSubmit,
    disabled,
    error,
    progress,
    savedDecks = [],
    onSavedDecksChange = () => {},
    accountDecks = null,
    onAccountSaveDeck = () => {},
    onAccountLoadDeck = () => {},
    onAccountDeleteDeck = () => {},
  },
  ref,
) {
  const usingAccount = accountDecks !== null;
  const [playerName, setPlayerName] = useState("");
  const [format, setFormat] = useState("freeform");
  const [playerDeck, setPlayerDeck] = useState("");
  const [sideboard, setSideboard] = useState("");
  const [opponentMode, setOpponentMode] = useState<OpponentMode>("basic");
  const [opponentDeck, setOpponentDeck] = useState("");
  const [opponentSideboard, setOpponentSideboard] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [saveName, setSaveName] = useState("");

  const handleLoadDeck = (deck: SavedDeck) => {
    setFormat(deck.format);
    setPlayerDeck(deck.playerDeck);
    setSideboard(deck.sideboard);
  };

  useImperativeHandle(ref, () => ({
    loadDeck: handleLoadDeck,
    getCurrentDeck: () => ({ format, playerDeck, sideboard }),
  }));

  const handleSaveDeck = () => {
    const name = saveName.trim();
    if (!name) return;
    if (usingAccount) {
      onAccountSaveDeck(name, format, withSideboard(playerDeck, sideboard));
    } else {
      onSavedDecksChange(saveDeck({ name, format, playerDeck, sideboard }));
    }
    setSaveName("");
  };

  const handleDeleteDeck = (name: string) => {
    if (usingAccount) {
      onAccountDeleteDeck(name);
    } else {
      onSavedDecksChange(deleteDeck(name));
    }
  };

  /** Guest decks (SavedDeck) already carry their full content - apply immediately.
   * Account decks are just a {name, format} summary in this list - request the real
   * content and let it arrive later via the ref (App.tsx wires ACCOUNT_DECK to that). */
  const handleClickSavedDeck = (deck: { name: string; format: string | null }) => {
    if (usingAccount) {
      onAccountLoadDeck(deck.name);
    } else {
      const full = savedDecks.find((d) => d.name === deck.name);
      if (full) handleLoadDeck(full);
    }
  };

  const myDecks: Array<{ name: string; format: string | null }> = usingAccount ? (accountDecks ?? []) : savedDecks;

  const isCommander = format === "commander";
  const needsOpponentDeck = opponentMode === "provide";
  const canSubmit =
    playerName.trim().length > 0 &&
    playerDeck.trim().length > 0 &&
    (!isCommander || sideboard.trim().length > 0) &&
    (!needsOpponentDeck || opponentDeck.trim().length > 0) &&
    (!needsOpponentDeck || !isCommander || opponentSideboard.trim().length > 0) &&
    !disabled;

  const handleSubmit = () => {
    onSubmit({
      playerName: playerName.trim(),
      format,
      playerDeck: withSideboard(playerDeck, sideboard),
      opponentMode,
      opponentDeck: needsOpponentDeck ? withSideboard(opponentDeck, opponentSideboard) : undefined,
      difficulty: opponentMode === "counter" ? difficulty : undefined,
    });
  };

  return (
    <div className="deck-entry">
      <h2>Practice against an LLM bot</h2>

      <div className="deck-entry-row">
        <label className="deck-entry-field deck-entry-field-inline">
          Your name
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={14}
            placeholder="up to 14 characters"
            disabled={disabled}
          />
        </label>

        <label className="deck-entry-field deck-entry-field-inline">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)} disabled={disabled}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="my-decks">
        <h3>My Decks{usingAccount && <span className="deck-entry-hint"> - saved to your account</span>}</h3>
        {myDecks.length === 0 ? (
          <p className="deck-entry-hint">No saved decks yet - build your deck below, then save it here for next time.</p>
        ) : (
          <ul className="my-decks-list">
            {myDecks.map((deck) => (
              <li key={deck.name}>
                <button type="button" onClick={() => handleClickSavedDeck(deck)} disabled={disabled}>
                  {deck.name} ({(deck.format && FORMATS.find((f) => f.id === deck.format)?.label) ?? deck.format ?? "any format"})
                </button>
                <button
                  type="button"
                  className="my-decks-delete"
                  aria-label={`Delete ${deck.name}`}
                  onClick={() => handleDeleteDeck(deck.name)}
                  disabled={disabled}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="my-decks-save">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this deck to save it"
            maxLength={40}
            disabled={disabled}
          />
          <button type="button" onClick={handleSaveDeck} disabled={disabled || !saveName.trim() || !playerDeck.trim()}>
            Save current deck
          </button>
        </div>
      </div>

      <div className="deck-channels">
        <div className="deck-channel">
          <h3>Your deck</h3>
          <label className="deck-entry-field">
            Decklist
            <textarea
              value={playerDeck}
              onChange={(e) => setPlayerDeck(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={12}
              disabled={disabled}
            />
          </label>
          <label className="deck-entry-field">
            Sideboard{isCommander ? " (required)" : " (optional)"}
            {isCommander && <span className="deck-entry-hint">Drop your commander here.</span>}
            <textarea
              value={sideboard}
              onChange={(e) => setSideboard(e.target.value)}
              placeholder={isCommander ? "1 Krenko, Mob Boss" : "Sideboard cards, if any"}
              rows={3}
              disabled={disabled}
            />
          </label>
        </div>

        <div className="deck-channel">
          <h3>Opponent's deck</h3>
          <div className="opponent-mode-choices" role="radiogroup" aria-label="Opponent deck source">
            <label>
              <input
                type="radio"
                name="opponentMode"
                value="basic"
                checked={opponentMode === "basic"}
                onChange={() => setOpponentMode("basic")}
                disabled={disabled}
              />
              Use a basic deck
            </label>
            <label>
              <input
                type="radio"
                name="opponentMode"
                value="provide"
                checked={opponentMode === "provide"}
                onChange={() => setOpponentMode("provide")}
                disabled={disabled}
              />
              Provide a deck
            </label>
            <label>
              <input
                type="radio"
                name="opponentMode"
                value="counter"
                checked={opponentMode === "counter"}
                onChange={() => setOpponentMode("counter")}
                disabled={disabled}
              />
              Analyze my deck and build a counter
            </label>
          </div>

          {opponentMode === "provide" && (
            <>
              <label className="deck-entry-field">
                Decklist
                <textarea
                  value={opponentDeck}
                  onChange={(e) => setOpponentDeck(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={12}
                  disabled={disabled}
                />
              </label>
              <label className="deck-entry-field">
                Sideboard{isCommander ? " (required)" : " (optional)"}
                {isCommander && <span className="deck-entry-hint">Drop the commander here.</span>}
                <textarea
                  value={opponentSideboard}
                  onChange={(e) => setOpponentSideboard(e.target.value)}
                  placeholder={isCommander ? "1 Krenko, Mob Boss" : "Sideboard cards, if any"}
                  rows={3}
                  disabled={disabled}
                />
              </label>
            </>
          )}

          {opponentMode === "counter" && (
            <label className="deck-entry-field">
              Difficulty
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} disabled={disabled}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {error && <div className="deck-entry-error">{error}</div>}

      <button disabled={!canSubmit} onClick={handleSubmit}>
        {disabled ? "Joining..." : "Start game"}
      </button>

      {disabled && progress && <div className="deck-entry-progress">{progress}</div>}
    </div>
  );
});
