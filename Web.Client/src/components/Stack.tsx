import type { CardsView, CardView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface StackProps {
  cards: CardsView;
  onHover?: (card: CardView | null) => void;
}

export function Stack({ cards, onHover }: StackProps) {
  const list = Object.values(cards ?? {});
  if (list.length === 0) {
    return null;
  }

  return (
    <div className="stack">
      <div className="zone-label">Stack</div>
      <div className="stack-cards">
        {list.map((card) => (
          <CardTile key={card.id} card={card} onHover={onHover} />
        ))}
      </div>
    </div>
  );
}
