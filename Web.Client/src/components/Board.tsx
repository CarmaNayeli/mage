import { useEffect, useState } from "react";
import type { CardView, GameView } from "../types/gameView";
import { Hand } from "./Hand";
import { PlayerPanel } from "./PlayerPanel";
import { Stack } from "./Stack";

interface BoardProps {
  game: GameView;
  /** Fires for a hand card, or a battlefield permanent of the human's own that's
   * currently legal to click (canPlayObjects, or a declare-attackers/blockers
   * selection) - same wire call (send_uuid) either way. */
  onPlayCard?: (card: CardView) => void;
  /** Card ids that are legal to click right now - the union of canPlayObjects' keys
   * and any active attacker/blocker selection (see utils/combat.ts). Without this,
   * nothing distinguishes a clickable permanent from an inert one, and battlefield
   * cards have no way to be clicked at all (only hand cards did, until combat -
   * declaring attackers/blockers - needed to click permanents too). */
  playableIds?: Set<string>;
  /** Reports hover changes up to App, which owns the shared "hold Z to zoom" overlay
   * (see utils/useCardZoom.ts) - lifted out of Board so it also works over cards
   * rendered elsewhere (a DialogPrompt's target list), not just the board itself. */
  onHover?: (card: CardView | null) => void;
}

export function Board({ game, onPlayCard, playableIds, onHover }: BoardProps) {
  // Defensive: every payload shape assumed here has already been wrong once for real
  // (GAME_UPDATE_AND_INFORM's wrapper crashed this exact line in production) - a
  // missing/malformed field should degrade gracefully, not take the whole app down.
  const players = game.players ?? [];
  const me = players.find((p) => p.playerId === game.myPlayerId);
  const opponents = players.filter((p) => p.playerId !== game.myPlayerId);

  // Tracked locally too (not just reported up via onHover) because the T hotkey below
  // needs to read the current value back.
  const [hoveredCard, setHoveredCardState] = useState<CardView | null>(null);
  const setHoveredCard = (card: CardView | null) => {
    setHoveredCardState(card);
    onHover?.(card);
  };

  // T "taps"/activates the hovered card - only meaningful (and only wired to actually
  // do anything) when it's one canPlayObjects/a combat selection already says is legal
  // to click, same as clicking it directly. (Z-to-zoom itself lives at the App level now.)
  useEffect(() => {
    const isTypingTarget = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      return !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if ((e.key === "t" || e.key === "T") && hoveredCard) {
        if (playableIds?.has(hoveredCard.id)) {
          onPlayCard?.(hoveredCard);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hoveredCard, playableIds, onPlayCard]);

  return (
    <div className="board">
      <div className="board-header">
        <span>
          Turn {game.turn} - {game.phase} / {game.step} - Active: {game.activePlayerName}
        </span>
        <span>Priority: {game.priorityPlayerName}</span>
      </div>
      <div className="board-hotkeys">Hover a card: hold Z to zoom, T to play/activate it (if legal)</div>

      <div className="opponents">
        {opponents.map((player) => (
          <PlayerPanel
            key={player.playerId}
            player={player}
            isActivePlayer={player.playerId === game.activePlayerId}
            onHover={setHoveredCard}
          />
        ))}
      </div>

      <Stack cards={game.stack} onHover={setHoveredCard} />

      {me && (
        <div className="me">
          <PlayerPanel
            player={me}
            isActivePlayer={me.playerId === game.activePlayerId}
            onCardClick={onPlayCard}
            playableIds={playableIds}
            onHover={setHoveredCard}
          />
          <div className="zone-label">Hand</div>
          <Hand cards={game.myHand} onCardClick={onPlayCard} playableIds={playableIds} onHover={setHoveredCard} />
        </div>
      )}
    </div>
  );
}
