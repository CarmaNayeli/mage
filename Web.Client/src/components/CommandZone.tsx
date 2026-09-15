import type { CardView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface CommandZoneProps {
  /** PlayerView.commandList, unfiltered - see the type's own doc comment for why this
   * can hold non-card entries (emblems/dungeons/planes) that must never reach CardTile. */
  commandList?: CardView[];
  onCardClick?: (card: CardView) => void;
  playableIds?: Set<string>;
  onHover?: (card: CardView | null) => void;
}

/** A Commander's card sits in the command zone, not the battlefield/hand - without
 * this it was simply invisible on the board (and, since casting it is just another
 * canPlayObjects entry like anything else, unclickable too). Renders nothing outside
 * Commander-family formats, where commandList is empty - unlike Exile, there's no
 * "Commander (0)" placeholder to show everyone else. */
export function CommandZone({ commandList, onCardClick, playableIds, onHover }: CommandZoneProps) {
  const commanders = (commandList ?? []).filter((c) => c.mageObjectType === "COMMANDER");
  if (commanders.length === 0) {
    return null;
  }

  return (
    <div className="command-zone">
      <span className="zone-label">Commander</span>
      <div className="command-zone-cards">
        {commanders.map((card) => {
          const playable = playableIds?.has(card.id) ?? false;
          return (
            <CardTile key={card.id} card={card} onClick={playable ? onCardClick : undefined} playable={playable} onHover={onHover} />
          );
        })}
      </div>
    </div>
  );
}
