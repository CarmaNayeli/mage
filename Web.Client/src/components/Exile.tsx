import type { CardView, ExileView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface ExileProps {
  exiles: ExileView[];
  onHover?: (card: CardView | null) => void;
}

export function Exile({ exiles, onHover }: ExileProps) {
  // ExileView's real shape is still unconfirmed (observed as [{}] - empty objects -
  // in every real dump so far, nothing was ever exiled during that playtest), so
  // this stays defensive rather than trusting `id`/`name`/`cards` to be present.
  const nonEmpty = (exiles ?? []).filter((exile) => Object.keys(exile?.cards ?? {}).length > 0);

  // Always rendered (even with nothing exiled) - hiding the zone entirely read as "this
  // game has no exile," not "nothing's there right now," which isn't true of a real
  // Magic game (every game has an exile zone, it's just usually empty).
  if (nonEmpty.length === 0) {
    return (
      <div className="exile">
        <div className="exile-zone">
          <span className="zone-label">Exile (0)</span>
          <div className="zone-empty">Nothing exiled</div>
        </div>
      </div>
    );
  }

  return (
    <div className="exile">
      {nonEmpty.map((exileZone, i) => (
        <div key={exileZone.id ?? i} className="exile-zone">
          <span className="zone-label">{exileZone.name || "Exile"}</span>
          <div className="exile-cards">
            {Object.values(exileZone.cards ?? {}).map((card) => (
              <CardTile key={card.id} card={card} onHover={onHover} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
