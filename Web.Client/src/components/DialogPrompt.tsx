import type { DialogPayload } from "../types/envelope";

interface DialogPromptProps {
  type: string;
  payload: DialogPayload;
  onChoose: (index: number) => void;
}

/**
 * One generic renderer for every dialog-shaped callback (GAME_TARGET, GAME_ASK,
 * GAME_SELECT, GAME_CHOOSE_ABILITY, ...) - same "engine enumerates, human picks"
 * pattern the LLM bridge already uses server-side. Payload shape is provisional
 * (see types/envelope.ts) until validated against a real dump.
 */
export function DialogPrompt({ type, payload, onChoose }: DialogPromptProps) {
  return (
    <div className="dialog-prompt">
      <div className="dialog-type">{type}</div>
      {payload.message && <div className="dialog-message">{payload.message}</div>}
      <div className="dialog-options">
        {payload.options?.map((option) => (
          <button key={option.index} onClick={() => onChoose(option.index)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
