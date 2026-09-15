import { useState } from "react";

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

export function DeckEntry({ onSubmit, disabled, error, progress }: DeckEntryProps) {
  const [playerName, setPlayerName] = useState("");
  const [format, setFormat] = useState("freeform");
  const [playerDeck, setPlayerDeck] = useState("");
  const [opponentMode, setOpponentMode] = useState<OpponentMode>("basic");
  const [opponentDeck, setOpponentDeck] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const needsOpponentDeck = opponentMode === "provide";
  const canSubmit =
    playerName.trim().length > 0 &&
    playerDeck.trim().length > 0 &&
    (!needsOpponentDeck || opponentDeck.trim().length > 0) &&
    !disabled;

  const handleSubmit = () => {
    onSubmit({
      playerName: playerName.trim(),
      format,
      playerDeck,
      opponentMode,
      opponentDeck: needsOpponentDeck ? opponentDeck : undefined,
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

      <div className="deck-channels">
        <div className="deck-channel">
          <h3>Your deck</h3>
          <label className="deck-entry-field">
            Decklist
            <textarea
              value={playerDeck}
              onChange={(e) => setPlayerDeck(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={14}
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
            <label className="deck-entry-field">
              Decklist
              <textarea
                value={opponentDeck}
                onChange={(e) => setOpponentDeck(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={14}
                disabled={disabled}
              />
            </label>
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
}
