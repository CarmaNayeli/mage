import type { ExileView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface ExileProps {
  exiles: ExileView[];
}

export function Exile({ exiles }: ExileProps) {
  const nonEmpty = exiles.filter((exile) => Object.keys(exile.cards).length > 0);
  if (nonEmpty.length === 0) {
    return null;
  }

  return (
    <div className="exile">
      {nonEmpty.map((exileZone) => (
        <div key={exileZone.id} className="exile-zone">
          <span className="zone-label">{exileZone.name || "Exile"}</span>
          <div className="exile-cards">
            {Object.values(exileZone.cards).map((card) => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
