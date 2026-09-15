import type { PlayerView } from "../types/gameView";
import { Battlefield } from "./Battlefield";

interface PlayerPanelProps {
  player: PlayerView;
  isActivePlayer: boolean;
}

export function PlayerPanel({ player, isActivePlayer }: PlayerPanelProps) {
  return (
    <div className={`player-panel${isActivePlayer ? " active" : ""}${player.hasLeft ? " left" : ""}`}>
      <div className="player-header">
        <span className="player-name">{player.name}</span>
        <span className="player-life">{player.life}</span>
        {!player.human && <span className="player-badge">Bot</span>}
        <span className="player-hand-count">{player.handCount} cards</span>
      </div>
      <Battlefield cards={player.battlefield} />
    </div>
  );
}
