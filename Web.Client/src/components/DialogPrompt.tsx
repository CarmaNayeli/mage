import { useState } from "react";
import type { AbilityPickerPayload, DialogPayload, GameClientMessage } from "../types/envelope";
import type { CardsView, GameView } from "../types/gameView";

interface DialogPromptProps {
  type: string;
  payload: DialogPayload;
  game: GameView | null;
  /** Mirrors the real Session API: exactly one of these five per response. */
  onRespond: (call: "send_uuid" | "send_boolean" | "send_integer" | "send_string" | "send_mana_type", args: unknown[]) => void;
}

const MANA_TYPES = ["White", "Blue", "Black", "Red", "Green", "Generic"];

function isAbilityPicker(type: string, _payload: DialogPayload): _payload is AbilityPickerPayload {
  return type === "GAME_CHOOSE_ABILITY";
}

/** Best-effort card name lookup across every zone this client knows about, for
 * GAME_TARGET/GAME_SELECT's bare UUID lists - falls back to a truncated id. */
function findCardName(game: GameView | null, id: string): string {
  if (!game) return id.slice(0, 8);
  const players = game.players ?? [];
  const pools: (CardsView | undefined)[] = [game.myHand, game.stack, ...players.map((p) => p.battlefield), ...players.map((p) => p.graveyard)];
  for (const pool of pools) {
    if (pool?.[id]) return pool[id].name;
  }
  return id.slice(0, 8);
}

export function DialogPrompt({ type, payload, game, onRespond }: DialogPromptProps) {
  const [amount, setAmount] = useState("");
  const message = isAbilityPicker(type, payload) ? payload.message : (payload as GameClientMessage).message;

  return (
    <div className="dialog-prompt">
      <div className="dialog-type">{type}</div>
      {message && <div className="dialog-message">{message}</div>}
      <div className="dialog-options">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    if (isAbilityPicker(type, payload)) {
      return Object.entries(payload.choices).map(([id, label]) => (
        <button key={id} onClick={() => onRespond("send_uuid", [id])}>
          {label}
        </button>
      ));
    }

    const gcm = payload as GameClientMessage;

    switch (type) {
      case "GAME_ASK":
        return (
          <>
            <button onClick={() => onRespond("send_boolean", [true])}>Yes</button>
            <button onClick={() => onRespond("send_boolean", [false])}>No</button>
          </>
        );

      case "GAME_TARGET":
      case "GAME_SELECT":
        return (
          <>
            {(gcm.targets ?? []).map((id) => (
              <button key={id} onClick={() => onRespond("send_uuid", [id])}>
                {findCardName(game, id)}
              </button>
            ))}
            {!gcm.flag && <button onClick={() => onRespond("send_boolean", [false])}>Cancel</button>}
          </>
        );

      case "GAME_CHOOSE_PILE":
        return (
          <>
            <button onClick={() => onRespond("send_boolean", [true])}>
              Pile 1 ({Object.keys(gcm.cardsView1 ?? {}).length} cards)
            </button>
            <button onClick={() => onRespond("send_boolean", [false])}>
              Pile 2 ({Object.keys(gcm.cardsView2 ?? {}).length} cards)
            </button>
          </>
        );

      case "GAME_CHOOSE_CHOICE": {
        const choice = gcm.choice;
        if (choice?.keyChoices) {
          return Object.entries(choice.keyChoices).map(([key, label]) => (
            <button key={key} onClick={() => onRespond("send_string", [key])}>
              {label}
            </button>
          ));
        }
        return (choice?.choices ?? []).map((value) => (
          <button key={value} onClick={() => onRespond("send_string", [value])}>
            {value}
          </button>
        ));
      }

      case "GAME_PLAY_MANA":
        return (
          <>
            {MANA_TYPES.map((manaType) => (
              <button
                key={manaType}
                onClick={() => game?.myPlayerId && onRespond("send_mana_type", [game.myPlayerId, manaType.toUpperCase()])}
              >
                {manaType}
              </button>
            ))}
            <button onClick={() => onRespond("send_boolean", [false])}>Cancel</button>
          </>
        );

      case "GAME_PLAY_XMANA":
        return (
          <>
            <button onClick={() => onRespond("send_boolean", [true])}>Confirm</button>
            <button onClick={() => onRespond("send_boolean", [false])}>Cancel</button>
          </>
        );

      case "GAME_GET_AMOUNT":
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRespond("send_integer", [Number(amount) || 0]);
            }}
          >
            <input
              type="number"
              value={amount}
              min={gcm.min}
              max={gcm.max}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            <button type="submit">OK</button>
            <button type="button" onClick={() => onRespond("send_boolean", [false])}>
              Cancel
            </button>
          </form>
        );

      case "GAME_GET_MULTI_AMOUNT":
        // Exact expected string format is unconfirmed (see envelope.ts) - comma-joined
        // is a best-effort guess pending a real payload to verify against.
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRespond("send_string", [amount]);
            }}
          >
            {(gcm.messages ?? []).map((m, i) => (
              <div key={i}>{m.message}</div>
            ))}
            <input type="text" value={amount} placeholder="comma-separated amounts" onChange={(e) => setAmount(e.target.value)} />
            <button type="submit">OK</button>
          </form>
        );

      default:
        return <div className="dialog-unhandled">Unhandled dialog type - no response sent.</div>;
    }
  }
}
