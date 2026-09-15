import type { ExileView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface ExileProps {
  exiles: ExileView[];
}

export function Exile({ exiles }: ExileProps) {
  // ExileView's real shape is still unconfirmed (observed as [{}] - empty objects -
  // in every real dump so far, nothing was ever exiled during that playtest), so
  // this stays defensive rather than trusting `id`/`name`/`cards` to be present.
  const nonEmpty = (exiles ?? []).filter((exile) => Object.keys(exile?.cards ?? {}).length > 0);
  if (nonEmpty.length === 0) {
    return null;
  }

  return (
    <div className="exile">
      {nonEmpty.map((exileZone, i) => (
        <div key={exileZone.id ?? i} className="exile-zone">
          <span className="zone-label">{exileZone.name || "Exile"}</span>
          <div className="exile-cards">
            {Object.values(exileZone.cards ?? {}).map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
