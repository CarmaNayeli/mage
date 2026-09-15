import { useEffect, useState } from "react";
import type { CardView, GameView } from "../types/gameView";
import { CardZoom } from "./CardZoom";
import { Exile } from "./Exile";
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
}

export function Board({ game, onPlayCard, playableIds }: BoardProps) {
  // Defensive: every payload shape assumed here has already been wrong once for real
  // (GAME_UPDATE_AND_INFORM's wrapper crashed this exact line in production) - a
  // missing/malformed field should degrade gracefully, not take the whole app down.
  const players = game.players ?? [];
  const me = players.find((p) => p.playerId === game.myPlayerId);
  const opponents = players.filter((p) => p.playerId !== game.myPlayerId);

  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null);
  const [zoomKeyHeld, setZoomKeyHeld] = useState(false);
  // Zoom tracks the held key, not a toggle - it's only up while Z is actually held
  // down (and follows whatever card the mouse is over meanwhile), and disappears the
  // instant it's released.
  const zoomedCard = zoomKeyHeld ? hoveredCard : null;

  // Keyboard shortcuts: hold Z to zoom in on whatever card the mouse is over (there's
  // no other way to read a card's rules text off the small board tiles), T "taps"/
  // activates it - only meaningful (and only wired to actually do anything) when the
  // hovered card is one canPlayObjects/a combat selection already says is legal to
  // click, same as clicking it directly.
  useEffect(() => {
    const isTypingTarget = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      return !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (e.key === "z" || e.key === "Z") {
        setZoomKeyHeld(true);
      } else if ((e.key === "t" || e.key === "T") && hoveredCard) {
        if (playableIds?.has(hoveredCard.id)) {
          onPlayCard?.(hoveredCard);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "z" || e.key === "Z") {
        setZoomKeyHeld(false);
      }
    };
    // If focus/the window itself is lost while Z is held (alt-tab, etc.), the keyup
    // never fires - drop the zoom rather than leave it stuck open.
    const onBlur = () => setZoomKeyHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
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
      <Exile exiles={game.exiles} onHover={setHoveredCard} />

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

      {zoomedCard && <CardZoom card={zoomedCard} onClose={() => setZoomKeyHeld(false)} />}
    </div>
  );
}
