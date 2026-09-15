import { useState } from "react";

interface DeckEntryProps {
  onSubmit: (decklistText: string, playerName: string) => void;
  disabled?: boolean;
  error?: string | null;
}

const PLACEHOLDER = `Paste a decklist, one card per line, e.g.:

4 Lightning Bolt
20 Mountain
4 Grizzly Bears
...`;

export function DeckEntry({ onSubmit, disabled, error }: DeckEntryProps) {
  const [playerName, setPlayerName] = useState("");
  const [decklistText, setDecklistText] = useState("");

  const canSubmit = playerName.trim().length > 0 && decklistText.trim().length > 0 && !disabled;

  return (
    <div className="deck-entry">
      <h2>Practice against an LLM bot</h2>

      <label className="deck-entry-field">
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

      <label className="deck-entry-field">
        Decklist
        <textarea
          value={decklistText}
          onChange={(e) => setDecklistText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={16}
          disabled={disabled}
        />
      </label>

      {error && <div className="deck-entry-error">{error}</div>}

      <button disabled={!canSubmit} onClick={() => onSubmit(decklistText, playerName.trim())}>
        {disabled ? "Joining..." : "Start game"}
      </button>
    </div>
  );
}
