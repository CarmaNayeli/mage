import { useEffect, useState } from "react";
import type { AbilityPickerPayload, DialogPayload, GameClientMessage } from "../types/envelope";
import type { CardsView, GameView } from "../types/gameView";
import { getCombatSelection } from "../utils/combat";
import { stripHtmlTags } from "../utils/text";

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

/** Best-effort name lookup for GAME_TARGET/GAME_SELECT's bare UUID lists - a target
 * can be a player (e.g. "Select a starting player", "choose a player to discard")
 * just as often as a card, and only checking card zones left player-id targets
 * rendered as raw truncated UUIDs. Falls back to a truncated id if nothing matches. */
function findCardName(game: GameView | null, id: string): string {
  if (!game) return id.slice(0, 8);
  const players = game.players ?? [];
  const player = players.find((p) => p.playerId === id);
  if (player) return player.name;
  const pools: (CardsView | undefined)[] = [game.myHand, game.stack, ...players.map((p) => p.battlefield), ...players.map((p) => p.graveyard)];
  for (const pool of pools) {
    if (pool?.[id]) return pool[id].name;
  }
  return id.slice(0, 8);
}

export function DialogPrompt({ type, payload, game, onRespond }: DialogPromptProps) {
  const [amount, setAmount] = useState("");
  const rawMessage = isAbilityPicker(type, payload) ? payload.message : (payload as GameClientMessage).message;
  const message = rawMessage ? stripHtmlTags(rawMessage) : rawMessage;

  // Keyboard shortcuts for the common cases - Enter for whichever button is the
  // "go ahead" action, Escape for "back out", A for the declare-attackers "All attack"
  // special button. GAME_GET_AMOUNT/GAME_GET_MULTI_AMOUNT already submit on Enter via
  // their native <form>, so they're left out here to avoid double-submitting.
  useEffect(() => {
    const gcm = payload as GameClientMessage;
    const combatSelection = type === "GAME_SELECT" ? getCombatSelection({ type, payload }) : null;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        return;
      }
      if (isAbilityPicker(type, payload)) {
        return;
      }
      switch (type) {
        case "GAME_ASK":
          if (e.key === "Enter") onRespond("send_boolean", [true]);
          else if (e.key === "Escape") onRespond("send_boolean", [false]);
          break;
        case "GAME_TARGET":
          if (e.key === "Escape" && !gcm.flag) onRespond("send_boolean", [false]);
          break;
        case "GAME_SELECT":
          if (combatSelection) {
            if (e.key === "Enter") onRespond("send_boolean", [true]);
            else if ((e.key === "a" || e.key === "A") && combatSelection.allAttackButton) onRespond("send_string", ["special"]);
          } else if (e.key === "Escape" && !gcm.flag) {
            onRespond("send_boolean", [false]);
          }
          break;
        case "GAME_PLAY_MANA":
          if (e.key === "Escape") onRespond("send_boolean", [false]);
          break;
        case "GAME_PLAY_XMANA":
          if (e.key === "Enter") onRespond("send_boolean", [true]);
          else if (e.key === "Escape") onRespond("send_boolean", [false]);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [type, payload, onRespond]);

  return (
    <div className="dialog-prompt">
      <div className="dialog-type">{type}</div>
      {message && <div className="dialog-message">{message}</div>}
      <div className="dialog-options">{renderBody()}</div>
      {hotkeyHint() && <div className="dialog-hotkeys">{hotkeyHint()}</div>}
    </div>
  );

  function hotkeyHint(): string | null {
    if (isAbilityPicker(type, payload)) return null;
    const gcm = payload as GameClientMessage;
    switch (type) {
      case "GAME_ASK":
        return "Enter = Yes, Esc = No";
      case "GAME_TARGET":
        return !gcm.flag ? "Esc = Cancel" : null;
      case "GAME_SELECT": {
        const combatSelection = getCombatSelection({ type, payload });
        if (combatSelection) {
          return combatSelection.allAttackButton ? "Enter = Done, A = All attack" : "Enter = Done";
        }
        return !gcm.flag ? "Esc = Cancel" : null;
      }
      case "GAME_PLAY_MANA":
        return "Esc = Cancel";
      case "GAME_PLAY_XMANA":
        return "Enter = Confirm, Esc = Cancel";
      default:
        return null;
    }
  }

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

      case "GAME_SELECT": {
        // Declaring attackers/blockers is the same GAME_SELECT as an ordinary priority
        // window, distinguished only by an options.possibleAttackers/possibleBlockers
        // list (see utils/combat.ts) - when present, the actual creatures to pick are
        // clickable directly on the board (Board.tsx wires them via playableIds), so
        // this dialog just needs a way to confirm the selection, not a duplicate list
        // of buttons.
        const combatSelection = getCombatSelection({ type, payload });
        if (combatSelection) {
          return (
            <>
              {combatSelection.allAttackButton && (
                <button onClick={() => onRespond("send_string", ["special"])}>{combatSelection.allAttackButton}</button>
              )}
              <button onClick={() => onRespond("send_boolean", [true])}>Done</button>
            </>
          );
        }
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
      }

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
