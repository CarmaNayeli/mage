import type { CardsView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface GraveyardProps {
  cards: CardsView;
}

export function Graveyard({ cards }: GraveyardProps) {
  const list = Object.values(cards);
  if (list.length === 0) {
    return null;
  }

  return (
    <div className="graveyard">
      <span className="zone-label">Graveyard ({list.length})</span>
      <div className="graveyard-cards">
        {list.map((card) => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
