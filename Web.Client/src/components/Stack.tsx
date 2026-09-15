import type { CardsView } from "../types/gameView";
import { CardTile } from "./CardTile";

interface StackProps {
  cards: CardsView;
}

export function Stack({ cards }: StackProps) {
  const list = Object.values(cards);
  if (list.length === 0) {
    return null;
  }

  return (
    <div className="stack">
      <div className="zone-label">Stack</div>
      <div className="stack-cards">
        {list.map((card) => (
          <CardTile key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
