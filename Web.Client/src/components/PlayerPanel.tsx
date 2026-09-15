import type { CardView, PlayerView } from "../types/gameView";
import { Battlefield } from "./Battlefield";
import { Graveyard } from "./Graveyard";
import { ManaPool } from "./ManaPool";

interface PlayerPanelProps {
  player: PlayerView;
  isActivePlayer: boolean;
  /** Only ever passed for the human's own panel - opponents' permanents aren't
   * clickable through the board (targeting them still goes through the dialog). */
  onCardClick?: (card: CardView) => void;
  playableIds?: Set<string>;
  onHover?: (card: CardView | null) => void;
}

export function PlayerPanel({ player, isActivePlayer, onCardClick, playableIds, onHover }: PlayerPanelProps) {
  return (
    <div className={`player-panel${isActivePlayer ? " active" : ""}${player.hasLeft ? " left" : ""}`}>
      <div className="player-header">
        <span className="player-name">{player.name}</span>
        <span className="player-life">{player.life}</span>
        {!player.isHuman && <span className="player-badge">Bot</span>}
        {player.manaPool && <ManaPool pool={player.manaPool} />}
        <span className="player-hand-count">{player.handCount} cards</span>
      </div>
      <Battlefield cards={player.battlefield} onCardClick={onCardClick} playableIds={playableIds} onHover={onHover} />
      <Graveyard cards={player.graveyard} onHover={onHover} />
    </div>
  );
}
