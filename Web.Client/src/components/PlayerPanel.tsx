import type { PlayerView } from "../types/gameView";
import { Battlefield } from "./Battlefield";
import { Graveyard } from "./Graveyard";
import { ManaPool } from "./ManaPool";

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
        {!player.isHuman && <span className="player-badge">Bot</span>}
        {player.manaPool && <ManaPool pool={player.manaPool} />}
        <span className="player-hand-count">{player.handCount} cards</span>
      </div>
      <Battlefield cards={player.battlefield} />
      <Graveyard cards={player.graveyard} />
    </div>
  );
}
