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
  const me = game.players.find((p) => p.playerId === game.myPlayerId);
  const opponents = game.players.filter((p) => p.playerId !== game.myPlayerId);

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
