import type { CardView, GameView } from "../types/gameView";
import { Exile } from "./Exile";
import { Hand } from "./Hand";
import { PlayerPanel } from "./PlayerPanel";
import { Stack } from "./Stack";

interface BoardProps {
  game: GameView;
  /** Hand cards are the only ones clickable for MVP - attempts to play the card. */
  onPlayCard?: (card: CardView) => void;
}

export function Board({ game, onPlayCard }: BoardProps) {
  // Defensive: every payload shape assumed here has already been wrong once for real
  // (GAME_UPDATE_AND_INFORM's wrapper crashed this exact line in production) - a
  // missing/malformed field should degrade gracefully, not take the whole app down.
  const players = game.players ?? [];
  const me = players.find((p) => p.playerId === game.myPlayerId);
  const opponents = players.filter((p) => p.playerId !== game.myPlayerId);

  return (
    <div className="board">
      <div className="board-header">
        <span>
          Turn {game.turn} - {game.phase} / {game.step}
        </span>
        <span>Priority: {game.priorityPlayerName}</span>
      </div>

      <div className="opponents">
        {opponents.map((player) => (
          <PlayerPanel key={player.playerId} player={player} isActivePlayer={player.playerId === game.activePlayerId} />
        ))}
      </div>

      <Stack cards={game.stack} />
      <Exile exiles={game.exiles} />

      {me && (
        <div className="me">
          <PlayerPanel player={me} isActivePlayer={me.playerId === game.activePlayerId} />
          <div className="zone-label">Hand</div>
          <Hand cards={game.myHand} onCardClick={onPlayCard} />
        </div>
      )}
    </div>
  );
}
