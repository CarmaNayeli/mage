import type { CardsView, CardView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface GraveyardProps {
  cards: CardsView;
  onHover?: (card: CardView | null) => void;
}

export function Graveyard({ cards, onHover }: GraveyardProps) {
  const list = Object.values(cards ?? {});
  if (list.length === 0) {
    return null;
  }

  return (
    <div className="graveyard">
      <span className="zone-label">Graveyard ({list.length})</span>
      <div className="graveyard-cards">
        {list.map((card) => (
          <CardTile key={card.id} card={card} onHover={onHover} />
        ))}
      </div>
    </div>
  );
}
