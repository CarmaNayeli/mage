import type { CardsView, CardView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface HandProps {
  cards: CardsView;
  onCardClick?: (card: CardView) => void;
}

export function Hand({ cards, onCardClick }: HandProps) {
  const list = Object.values(cards ?? {});

  return (
    <div className="hand">
      {list.length === 0 ? (
        <div className="zone-empty">Empty hand</div>
      ) : (
        list.map((card) => <CardTile key={card.id} card={card} onClick={onCardClick} />)
      )}
    </div>
  );
}
